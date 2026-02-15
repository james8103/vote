import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, Election, Stake, Message } from "./models.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// HTTP server
const server = http.createServer(app);

// MongoDB connection
await mongoose
	.connect(process.env.MONGODB_URI)
	.then(() => console.log("✅ MongoDB connected"))
	.catch((err) => console.error("MongoDB connection error:", err));

// ----------------------
// Helper functions
// ----------------------
async function getUser(username) {
	let user = await User.findOne({ username });
	if (!user) {
		user = new User({ username });
		await user.save();
	}
	return user;
}

// Helper to convert string ID to ObjectId if needed
function toObjectId(id) {
	if (!id) return null;

	// If it's already an ObjectId, return it
	if (id instanceof mongoose.Types.ObjectId) {
		return id;
	}

	// If it's a valid 24-character hex string, convert it
	if (typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id)) {
		return new mongoose.Types.ObjectId(id);
	}

	// Otherwise return as-is
	return id;
}

async function checkWinCondition(election) {
	if (election.status === "closed") return null;

	const voteCounts = election.voteCounts || new Map();

	for (const [candidate, count] of voteCounts.entries()) {
		if (count >= election.voteThreshold) {
			// We have a winner!
			election.status = "closed";
			election.winner = candidate;
			await election.save();

			// Award payouts
			const stakes = await Stake.find({ electionId: election._id });
			for (const s of stakes) {
				const user = await getUser(s.username);
				if (s.candidate === candidate) {
					s.balanceChange = s.amount * 2;
					user.balance += s.balanceChange;
				}
				await s.save();
				await user.save();
			}

			return candidate;
		}
	}

	return null;
}

const io = new Server(server, { cors: { origin: "*" } });

// ----------------------
// API routes
// ----------------------
app.get("/users", async (req, res) => {
	try {
		const users = await User.find({}, { username: 1, balance: 1 });
		res.json(users);
	} catch (err) {
		console.error("Error fetching users:", err);
		res.status(500).json({ error: "Failed to fetch users" });
	}
});

app.get("/elections", async (req, res) => {
	try {
		const elections = await Election.find();
		res.json(elections);
	} catch (err) {
		console.error("Error fetching elections:", err);
		res.status(500).json({ error: "Failed to fetch elections" });
	}
});

app.get("/votes/:electionId", async (req, res) => {
	try {
		const electionId = toObjectId(req.params.electionId);
		console.log("📊 Fetching votes for election:", electionId);

		const election = await Election.findById(electionId);
		if (!election) {
			console.log("❌ Election not found:", electionId);
			return res.status(404).json({ error: "Election not found" });
		}

		const voteCounts = {};
		if (election.voteCounts) {
			for (const [candidate, count] of election.voteCounts.entries()) {
				voteCounts[candidate] = count;
			}
		}

		res.json({
			votes: voteCounts,
			threshold: election.voteThreshold,
			winner: election.winner,
			status: election.status,
		});
	} catch (err) {
		console.error("Error fetching votes:", err);
		res.status(500).json({ error: "Failed to fetch votes" });
	}
});

app.get("/messages/:electionId", async (req, res) => {
	try {
		const electionId = toObjectId(req.params.electionId);
		console.log("💬 Fetching messages for election:", electionId);

		const messages = await Message.find({
			electionId: electionId,
		}).sort({ time: 1 });

		console.log(`📜 Found ${messages.length} messages`);
		res.json(messages);
	} catch (err) {
		console.error("Error fetching messages:", err);
		res.status(500).json({ error: "Failed to fetch messages" });
	}
});

app.post("/stake", async (req, res) => {
	try {
		const { username, electionId, candidate, amount } = req.body;
		console.log("📥 Stake request received:", {
			username,
			electionId,
			candidate,
			amount,
		});

		const objectId = toObjectId(electionId);
		console.log("🔍 Converted electionId:", objectId);

		const election = await Election.findById(objectId);
		console.log("🗳️ Election found:", election ? "Yes" : "No");

		if (!election) {
			console.log("❌ Election not found for ID:", electionId);
			return res.status(400).json({ error: "Election not found" });
		}

		console.log("📊 Election status:", election.status);

		if (election.status !== "open") {
			return res.status(400).json({ error: "Election is closed" });
		}

		const user = await getUser(username);
		console.log("👤 User balance:", user.balance);

		if (user.balance < amount) {
			return res.status(400).json({ error: "Not enough balance" });
		}

		// Deduct balance
		user.balance -= amount;
		await user.save();

		// Save stake - use the ObjectId version
		const stake = new Stake({
			username,
			electionId: objectId,
			candidate,
			amount,
		});
		await stake.save();

		// Update vote count
		if (!election.voteCounts) {
			election.voteCounts = new Map();
		}
		const currentVotes = election.voteCounts.get(candidate) || 0;
		election.voteCounts.set(candidate, currentVotes + 1);
		await election.save();

		console.log("✅ Vote recorded. New count:", currentVotes + 1);

		// Emit stake event to this election room
		io.to(`election:${electionId}`).emit("stake:placed", {
			username,
			candidate,
			amount,
			balance: user.balance,
		});

		// Emit updated vote counts
		const voteCounts = {};
		for (const [cand, count] of election.voteCounts.entries()) {
			voteCounts[cand] = count;
		}
		io.to(`election:${electionId}`).emit("votes:update", voteCounts);

		// Check for win condition
		const winner = await checkWinCondition(election);
		if (winner) {
			io.to(`election:${electionId}`).emit("election:resolved", {
				winner,
				results: await Stake.find({ electionId: objectId }),
			});

			// Broadcast announcement
			const announcement = new Message({
				electionId: objectId,
				username: "SYSTEM",
				message: `🎉 ${winner} has won the election with ${election.voteThreshold} votes!`,
			});
			await announcement.save();
			io.to(`election:${electionId}`).emit("chat:message", announcement);
		}

		// Emit updated balances to everyone
		const users = await User.find({}, { username: 1, balance: 1 });
		io.to(`election:${electionId}`).emit("balances:update", users);

		res.json({ success: true, balance: user.balance });
	} catch (err) {
		console.error("❌ Error in /stake:", err);
		res.status(500).json({ error: "Internal server error: " + err.message });
	}
});

app.post("/resolve", async (req, res) => {
	try {
		const { electionId, winner } = req.body;
		const objectId = toObjectId(electionId);

		const election = await Election.findById(objectId);
		if (!election) return res.status(404).json({ error: "Election not found" });

		election.status = "closed";
		election.winner = winner;
		await election.save();

		const stakes = await Stake.find({ electionId: objectId });
		for (const s of stakes) {
			const user = await getUser(s.username);
			if (s.candidate === winner) {
				s.balanceChange = s.amount * 2;
				user.balance += s.balanceChange;
			}
			await s.save();
			await user.save();
		}

		io.to(`election:${electionId}`).emit("election:resolved", {
			winner,
			results: stakes,
		});

		// Emit updated balances after resolution
		const users = await User.find({}, { username: 1, balance: 1 });
		io.to(`election:${electionId}`).emit("balances:update", users);

		res.json({ success: true, winner });
	} catch (err) {
		console.error("Error in /resolve:", err);
		res.status(500).json({ error: "Internal server error" });
	}
});

// ----------------------
// Socket.IO handlers
// ----------------------
io.on("connection", (socket) => {
	console.log("🔌 A user connected");

	socket.on("join", async ({ username, electionId }) => {
		try {
			console.log("👋 Join request:", { username, electionId });

			socket.join(`election:${electionId}`);
			const user = await getUser(username);

			const objectId = toObjectId(electionId);
			console.log("🔍 Looking for election with ID:", objectId);

			const election = await Election.findById(objectId);

			if (!election) {
				console.error("❌ Election not found for ID:", electionId);
				socket.emit("error", { message: "Election not found" });
				return;
			}

			console.log("✅ Election found:", election.title);

			// Send chat history to the user who just joined
			const chatHistory = await Message.find({
				electionId: objectId,
			}).sort({ time: 1 });

			console.log(`📜 Sending ${chatHistory.length} messages`);
			socket.emit("chat:history", chatHistory);

			socket.emit("joined", {
				username,
				balance: user.balance,
				election,
			});

			// Send current vote counts
			const voteCounts = {};
			if (election.voteCounts) {
				for (const [candidate, count] of election.voteCounts.entries()) {
					voteCounts[candidate] = count;
				}
			}
			socket.emit("votes:update", voteCounts);

			// Send current balances immediately on join
			const users = await User.find({}, { username: 1, balance: 1 });
			io.emit("balances:update", users);
		} catch (err) {
			console.error("❌ Error on join:", err);
			socket.emit("error", { message: "Failed to join election" });
		}
	});

	socket.on("chat:message", async ({ electionId, username, message }) => {
		try {
			const objectId = toObjectId(electionId);

			const chatMsg = new Message({
				electionId: objectId,
				username,
				message,
			});
			await chatMsg.save();

			io.to(`election:${electionId}`).emit("chat:message", chatMsg);
		} catch (err) {
			console.error("Error on chat:message:", err);
		}
	});

	socket.on("disconnect", () => {
		console.log("🔌 User disconnected");
	});
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 3001;
server.listen(PORT, () =>
	console.log(`✅ Server running on http://localhost:${PORT}`),
);
