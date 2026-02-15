import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, Election, Stake, Message, UserElection } from "./models.js";
import { generateUserPayouts, getUserIndex } from "./payoutGenerator.js";

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
	if (id instanceof mongoose.Types.ObjectId) return id;
	if (typeof id === "string" && /^[0-9a-fA-F]{24}$/.test(id)) {
		return new mongoose.Types.ObjectId(id);
	}
	return id;
}

// Get or create UserElection record with personalized payouts
async function getUserElectionRecord(username, electionId) {
	const objectId = toObjectId(electionId);

	let userElection = await UserElection.findOne({
		username,
		electionId: objectId,
	});

	if (!userElection) {
		// First time user joins this election - create record
		const election = await Election.findById(objectId);
		if (!election) {
			throw new Error("Election not found");
		}

		// Generate personalized payouts
		const userIdx = getUserIndex(username);
		const payouts = generateUserPayouts(election.candidates, userIdx);

		userElection = new UserElection({
			username,
			electionId: objectId,
			hasJoined: true,
			payouts: payouts,
		});

		await userElection.save();
		console.log(`✨ Generated payouts for ${username}:`, payouts);
	}

	return userElection;
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

			console.log(`🎉 ${candidate} won! Distributing payouts...`);

			// Get all users who participated in this election
			const participants = await UserElection.find({
				electionId: election._id,
				hasVoted: true,
			});

			// Distribute personalized payouts
			for (const participant of participants) {
				const user = await getUser(participant.username);
				const payout = participant.payouts.get(candidate) || 0;

				user.balance += payout;
				await user.save();

				console.log(
					`💰 ${participant.username}: ${payout > 0 ? "+" : ""}${payout} coins (new balance: ${user.balance})`,
				);

				// Update stake record with payout info
				const stake = await Stake.findOne({
					username: participant.username,
					electionId: election._id,
				});
				if (stake) {
					stake.balanceChange = payout;
					await stake.save();
				}
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

// Get elections (only visible ones for regular users)
app.get("/elections", async (req, res) => {
	try {
		// Filter to only show visible elections
		const elections = await Election.find({ isVisible: true });
		res.json(elections);
	} catch (err) {
		console.error("Error fetching elections:", err);
		res.status(500).json({ error: "Failed to fetch elections" });
	}
});

// Admin endpoint to get ALL elections (including hidden)
app.get("/elections/all", async (req, res) => {
	try {
		const elections = await Election.find();
		res.json(elections);
	} catch (err) {
		console.error("Error fetching elections:", err);
		res.status(500).json({ error: "Failed to fetch elections" });
	}
});

// Toggle election visibility
app.patch("/elections/:electionId/visibility", async (req, res) => {
	try {
		const electionId = toObjectId(req.params.electionId);
		const { isVisible } = req.body;

		const election = await Election.findById(electionId);
		if (!election) {
			return res.status(404).json({ error: "Election not found" });
		}

		election.isVisible = isVisible;
		await election.save();

		console.log(`👁️ ${election.title} visibility set to: ${isVisible}`);
		res.json({ success: true, isVisible: election.isVisible });
	} catch (err) {
		console.error("Error updating visibility:", err);
		res.status(500).json({ error: "Failed to update visibility" });
	}
});

app.get("/votes/:electionId", async (req, res) => {
	try {
		const electionId = toObjectId(req.params.electionId);
		const election = await Election.findById(electionId);
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
			voteCost: election.voteCost,
		});
	} catch (err) {
		console.error("Error fetching votes:", err);
		res.status(500).json({ error: "Failed to fetch votes" });
	}
});

app.get("/messages/:electionId", async (req, res) => {
	try {
		const electionId = toObjectId(req.params.electionId);
		const messages = await Message.find({
			electionId: electionId,
		}).sort({ time: 1 });

		res.json(messages);
	} catch (err) {
		console.error("Error fetching messages:", err);
		res.status(500).json({ error: "Failed to fetch messages" });
	}
});

// Get user's personalized payouts for an election
app.get("/payouts/:electionId/:username", async (req, res) => {
	try {
		const electionId = toObjectId(req.params.electionId);
		const username = req.params.username;

		const userElection = await getUserElectionRecord(username, electionId);

		// Convert Map to plain object for JSON
		const payouts = {};
		for (const [candidate, amount] of userElection.payouts.entries()) {
			payouts[candidate] = amount;
		}

		res.json({
			payouts,
			hasVoted: userElection.hasVoted,
		});
	} catch (err) {
		console.error("Error fetching payouts:", err);
		res.status(500).json({ error: "Failed to fetch payouts" });
	}
});

app.post("/stake", async (req, res) => {
	try {
		const { username, electionId, candidate, amount } = req.body;
		console.log("📥 Vote request:", { username, electionId, candidate });

		const objectId = toObjectId(electionId);
		const election = await Election.findById(objectId);

		if (!election) {
			return res.status(400).json({ error: "Election not found" });
		}

		if (!election.isVisible) {
			return res.status(400).json({ error: "Election is not available" });
		}

		if (election.status !== "open") {
			return res.status(400).json({ error: "Election is closed" });
		}

		const user = await getUser(username);

		// Check if user can afford to vote
		const voteCost = election.voteCost || 50;
		if (user.balance <= 0) {
			return res
				.status(400)
				.json({ error: "Cannot vote with zero or negative balance" });
		}
		if (user.balance < voteCost) {
			return res.status(400).json({ error: "Not enough balance to vote" });
		}

		// Get user's election record
		const userElection = await getUserElectionRecord(username, objectId);

		if (userElection.hasVoted) {
			return res
				.status(400)
				.json({ error: "You have already voted in this election" });
		}

		// Deduct vote cost
		user.balance -= voteCost;
		await user.save();

		// Mark as voted
		userElection.hasVoted = true;
		await userElection.save();

		// Save stake
		const stake = new Stake({
			username,
			electionId: objectId,
			candidate,
			amount: voteCost,
		});
		await stake.save();

		// Update vote count
		if (!election.voteCounts) {
			election.voteCounts = new Map();
		}
		const currentVotes = election.voteCounts.get(candidate) || 0;
		election.voteCounts.set(candidate, currentVotes + 1);
		await election.save();

		console.log(
			`✅ ${username} voted for ${candidate}. New count: ${currentVotes + 1}`,
		);

		// Emit updates
		io.to(`election:${electionId}`).emit("stake:placed", {
			username,
			candidate,
			amount: voteCost,
			balance: user.balance,
		});

		const voteCounts = {};
		for (const [cand, count] of election.voteCounts.entries()) {
			voteCounts[cand] = count;
		}
		io.to(`election:${electionId}`).emit("votes:update", voteCounts);

		// Check for win condition
		const winner = await checkWinCondition(election);
		if (winner) {
			const results = await UserElection.find({
				electionId: objectId,
				hasVoted: true,
			});

			const payoutSummary = results.map((r) => ({
				username: r.username,
				payout: r.payouts.get(winner) || 0,
			}));

			io.to(`election:${electionId}`).emit("election:resolved", {
				winner,
				results: payoutSummary,
			});

			// Broadcast announcement
			const announcement = new Message({
				electionId: objectId,
				username: "SYSTEM",
				message: `🎉 ${winner} has won the election! Payouts distributed. Check your balance!`,
			});
			await announcement.save();
			io.to(`election:${electionId}`).emit("chat:message", announcement);
		}

		// Emit updated balances
		const users = await User.find({}, { username: 1, balance: 1 });
		io.to(`election:${electionId}`).emit("balances:update", users);

		res.json({ success: true, balance: user.balance });
	} catch (err) {
		console.error("❌ Error in /stake:", err);
		res.status(500).json({ error: err.message });
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

		// Distribute payouts
		const participants = await UserElection.find({
			electionId: objectId,
			hasVoted: true,
		});

		for (const participant of participants) {
			const user = await getUser(participant.username);
			const payout = participant.payouts.get(winner) || 0;
			user.balance += payout;
			await user.save();
		}

		io.to(`election:${electionId}`).emit("election:resolved", { winner });

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
			const election = await Election.findById(objectId);

			if (!election) {
				console.error("❌ Election not found");
				socket.emit("error", { message: "Election not found" });
				return;
			}

			// Check if election is visible
			if (!election.isVisible) {
				console.error("❌ Election not visible");
				socket.emit("error", { message: "Election is not available" });
				return;
			}

			// Get or create user election record
			const userElection = await getUserElectionRecord(username, objectId);

			// Give entry bonus if first time joining
			if (!userElection.hasReceivedBonus) {
				const bonus = election.entryBonus || 200;
				user.balance += bonus;
				await user.save();

				userElection.hasReceivedBonus = true;
				await userElection.save();

				console.log(`💰 ${username} received ${bonus} coin entry bonus`);

				// Send welcome message
				const welcomeMsg = new Message({
					electionId: objectId,
					username: "SYSTEM",
					message: `${username} joined the election and received ${bonus} coins! 🎁`,
				});
				await welcomeMsg.save();
				io.to(`election:${electionId}`).emit("chat:message", welcomeMsg);
			}

			// Send chat history
			const chatHistory = await Message.find({
				electionId: objectId,
			}).sort({ time: 1 });

			socket.emit("chat:history", chatHistory);

			// Convert payouts Map to object
			const payouts = {};
			for (const [candidate, amount] of userElection.payouts.entries()) {
				payouts[candidate] = amount;
			}

			socket.emit("joined", {
				username,
				balance: user.balance,
				election,
				payouts,
				hasVoted: userElection.hasVoted,
			});

			// Send current vote counts
			const voteCounts = {};
			if (election.voteCounts) {
				for (const [candidate, count] of election.voteCounts.entries()) {
					voteCounts[candidate] = count;
				}
			}
			socket.emit("votes:update", voteCounts);

			// Send current balances
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
