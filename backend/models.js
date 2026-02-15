import mongoose from "mongoose";

// User Schema
const userSchema = new mongoose.Schema({
	username: { type: String, unique: true },
	balance: { type: Number, default: 1000 },
});

// Election Schema
const electionSchema = new mongoose.Schema({
	title: String,
	description: String, // Optional description of the election
	candidates: [String],
	status: { type: String, default: "open" }, // open, closed
	winner: { type: String, default: null },
	voteThreshold: { type: Number, default: 100 },
	voteCounts: {
		type: Map,
		of: Number,
		default: {},
	},
	entryBonus: { type: Number, default: 200 }, // Coins given on first join
	voteCost: { type: Number, default: 50 }, // Cost to vote
	isVisible: { type: Boolean, default: true }, // NEW: Controls if users can see this election
	createdAt: { type: Date, default: Date.now },
	startsAt: { type: Date, default: null }, // Optional: when election becomes visible
	endsAt: { type: Date, default: null }, // Optional: when election closes
});

// Stake Schema (tracks who voted for whom)
const stakeSchema = new mongoose.Schema({
	username: String,
	electionId: mongoose.Schema.Types.ObjectId,
	candidate: String,
	amount: Number,
	balanceChange: { type: Number, default: 0 },
});

// Message Schema
const messageSchema = new mongoose.Schema({
	electionId: mongoose.Schema.Types.ObjectId,
	username: String,
	message: String,
	time: { type: Date, default: Date.now },
});

// User Election Participation Schema
const userElectionSchema = new mongoose.Schema({
	username: String,
	electionId: mongoose.Schema.Types.ObjectId,
	hasJoined: { type: Boolean, default: false },
	hasReceivedBonus: { type: Boolean, default: false },
	hasVoted: { type: Boolean, default: false },
	payouts: {
		type: Map,
		of: Number,
		default: {},
	},
	joinedAt: { type: Date, default: Date.now },
});

// Export Models
export const User = mongoose.model("User", userSchema);
export const Election = mongoose.model("Election", electionSchema);
export const Stake = mongoose.model("Stake", stakeSchema);
export const Message = mongoose.model("Message", messageSchema);
export const UserElection = mongoose.model("UserElection", userElectionSchema);
