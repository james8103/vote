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
		const election = await Election.findById(req.params.electionId);
		if (!election) {
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

app.post("/stake", async (req, res) => {
	try {
		const { username, electionId, candidate, amount } = req.body;
		const election = await Election.findById(electionId);
		const user = await getUser(username);

		if (!election || election.status !== "open") {
			return res.status(400).json({ error: "Election closed or not found" });
		}
		if (user.balance < amount) {
			return res.status(400).json({ error: "Not enough balance" });
		}

		// Deduct balance
		user.balance -= amount;
		await user.save();

		// Save stake
		const stake = new Stake({ username, electionId, candidate, amount });
		await stake.save();

		// Update vote count
		if (!election.voteCounts) {
			election.voteCounts = new Map();
		}
		const currentVotes = election.voteCounts.get(candidate) || 0;
		election.voteCounts.set(candidate, currentVotes + 1);
		await election.save();

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
				results: await Stake.find({ electionId }),
			});

			// Broadcast announcement
			const announcement = new Message({
				electionId,
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
		console.error("Error in /stake:", err);
		res.status(500).json({ error: "Internal server error" });
	}
});

app.post("/resolve", async (req, res) => {
	try {
		const { electionId, winner } = req.body;
		const election = await Election.findById(electionId);
		if (!election) return res.status(404).json({ error: "Election not found" });

		election.status = "closed";
		election.winner = winner;
		await election.save();

		const stakes = await Stake.find({ electionId });
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
	console.log("A user connected");

	socket.on("join", async ({ username, electionId }) => {
		try {
			socket.join(`election:${electionId}`);
			const user = await getUser(username);
			const election = await Election.findById(electionId);

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
			console.error("Error on join:", err);
		}
	});

	socket.on("chat:message", async ({ electionId, username, message }) => {
		try {
			const chatMsg = new Message({ electionId, username, message });
			await chatMsg.save();

			io.to(`election:${electionId}`).emit("chat:message", chatMsg);
		} catch (err) {
			console.error("Error on chat:message:", err);
		}
	});

	socket.on("disconnect", () => {
		console.log("User disconnected");
	});
});

// ----------------------
// Start server
// ----------------------
const PORT = process.env.PORT || 3001;
server.listen(PORT, () =>
	console.log(`✅ Server running on http://localhost:${PORT}`),
);
