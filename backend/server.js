import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

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
// Schemas & Models
// ----------------------
const userSchema = new mongoose.Schema({
	username: { type: String, unique: true },
	balance: { type: Number, default: 1000 },
});

const electionSchema = new mongoose.Schema({
	title: String,
	candidates: [String],
	status: { type: String, default: "open" },
	winner: { type: String, default: null },
});

const stakeSchema = new mongoose.Schema({
	username: String,
	electionId: mongoose.Schema.Types.ObjectId,
	candidate: String,
	amount: Number,
	balanceChange: { type: Number, default: 0 },
});

const messageSchema = new mongoose.Schema({
	electionId: mongoose.Schema.Types.ObjectId,
	username: String,
	message: String,
	time: { type: Date, default: Date.now },
});

const User = mongoose.model("User", userSchema);
const Election = mongoose.model("Election", electionSchema);
const Stake = mongoose.model("Stake", stakeSchema);
const Message = mongoose.model("Message", messageSchema);

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

// Get all elections
app.get("/elections", async (req, res) => {
	try {
		const elections = await Election.find();
		res.json(elections);
	} catch (err) {
		console.error("Error fetching elections:", err);
		res.status(500).json({ error: "Failed to fetch elections" });
	}
});

app.post("/stake", async (req, res) => {
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

	// Emit stake event to this election room
	io.to(`election:${electionId}`).emit("stake:placed", {
		username,
		candidate,
		amount,
		balance: user.balance,
	});

	// Emit updated balances to everyone
	const users = await User.find({}, { username: 1, balance: 1 });
	io.emit("balances:update", users);

	res.json({ success: true, balance: user.balance });
});

app.post("/resolve", async (req, res) => {
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
	io.emit("balances:update", users);

	res.json({ success: true, winner });
});

// ----------------------
// Socket.IO handlers
// ----------------------

io.on("connection", (socket) => {
	console.log("A user connected");

	socket.on("join", async ({ username, electionId }) => {
		socket.join(`election:${electionId}`);
		const user = await getUser(username);
		const election = await Election.findById(electionId);

		socket.emit("joined", {
			username,
			balance: user.balance,
			election,
		});

		// Send current balances immediately on join
		const users = await User.find({}, { username: 1, balance: 1 });
		io.emit("balances:update", users);
	});

	socket.on("chat:message", async ({ electionId, username, message }) => {
		const chatMsg = new Message({ electionId, username, message });
		await chatMsg.save();

		io.to(`election:${electionId}`).emit("chat:message", chatMsg);
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
	console.log(`✅ Server running on http://localhost:${PORT}`)
);
