import express from "express";
import http from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// HTTP server
const server = http.createServer(app);

// Socket.IO setup
const io = new Server(server, {
	cors: { origin: "*" },
});

// ----------------------
// In-memory data
// ----------------------
let users = []; // { username, balance }
let elections = [
	{
		id: "A",
		title: "Election A",
		candidates: ["Gerry", "Alex"],
		stakes: [],
		chat: [],
		status: "open",
		winner: null,
	},
];

// ----------------------
// Helper functions
// ----------------------
function getUser(username) {
	let user = users.find((u) => u.username === username);
	if (!user) {
		user = { username, balance: 1000 };
		users.push(user);
	}
	return user;
}

function getElection(id) {
	return elections.find((e) => e.id === id);
}

// ----------------------
// API routes
// ----------------------
app.get("/elections", (req, res) => {
	res.json(elections.map(({ chat, ...rest }) => rest));
});

app.post("/stake", (req, res) => {
	const { username, electionId, candidate, amount } = req.body;
	const election = getElection(electionId);
	const user = getUser(username);

	if (!election || election.status !== "open") {
		return res.status(400).json({ error: "Election closed or not found" });
	}
	if (user.balance < amount) {
		return res.status(400).json({ error: "Not enough balance" });
	}

	user.balance -= amount;
	election.stakes.push({ username, candidate, amount, balanceChange: 0 });

	io.to(`election:${electionId}`).emit("stake:placed", {
		username,
		candidate,
		amount,
		balance: user.balance,
	});

	res.json({ success: true, balance: user.balance });
});

app.post("/transfer", (req, res) => {
	const { from, to, amount } = req.body;
	const sender = getUser(from);
	const receiver = getUser(to);

	if (sender.balance < amount) {
		return res.status(400).json({ error: "Insufficient funds" });
	}

	sender.balance -= amount;
	receiver.balance += amount;

	io.emit("balances:update", users);
	res.json({ success: true });
});

app.post("/resolve", (req, res) => {
	const { electionId, winner } = req.body;
	const election = getElection(electionId);
	if (!election) return res.status(404).json({ error: "Election not found" });

	election.status = "closed";
	election.winner = winner;

	for (const s of election.stakes) {
		if (s.candidate === winner) {
			s.balanceChange = s.amount * 2;
		} else {
			s.balanceChange = 0;
		}
		const user = getUser(s.username);
		user.balance += s.balanceChange;
	}

	io.to(`election:${electionId}`).emit("election:resolved", {
		winner,
		results: election.stakes,
	});

	io.emit("balances:update", users);
	res.json({ success: true, winner });
});

// ----------------------
// Socket.IO handlers
// ----------------------
io.on("connection", (socket) => {
	console.log("A user connected");

	socket.on("join", ({ username, electionId }) => {
		socket.join(`election:${electionId}`);
		const user = getUser(username);

		socket.emit("joined", {
			username,
			balance: user.balance,
			election: getElection(electionId),
		});
	});

	socket.on("chat:message", ({ electionId, username, message }) => {
		const election = getElection(electionId);
		if (!election) return;

		const chatMsg = { username, message, time: Date.now() };
		election.chat.push(chatMsg);

		io.to(`election:${electionId}`).emit("chat:message", chatMsg);
	});

	socket.on("disconnect", () => {
		console.log("User disconnected");
	});
});

// ----------------------
// Start server
// ----------------------
const PORT = 3001;
server.listen(PORT, () =>
	console.log(`✅ Server running on http://localhost:${PORT}`)
);
