import mongoose from "mongoose";

// User Schema
const userSchema = new mongoose.Schema({
	username: { type: String, unique: true },
	balance: { type: Number, default: 1000 },
});

// Election Schema
const electionSchema = new mongoose.Schema({
	title: String,
	candidates: [String],
	status: { type: String, default: "open" },
	winner: { type: String, default: null },
	voteThreshold: { type: Number, default: 100 },
	voteCounts: {
		type: Map,
		of: Number,
		default: {},
	},
	entryBonus: { type: Number, default: 200 }, // Coins given on first join
	voteCost: { type: Number, default: 50 }, // Cost to vote
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

// NEW: User Election Participation Schema
// Tracks which users have joined which elections and their personalized payouts
const userElectionSchema = new mongoose.Schema({
	username: String,
	electionId: mongoose.Schema.Types.ObjectId,
	hasJoined: { type: Boolean, default: false }, // Prevents bonus abuse
	hasReceivedBonus: { type: Boolean, default: false },
	hasVoted: { type: Boolean, default: false },
	// Personalized payouts for each candidate
	// Format: { "CandidateName": payoutAmount }
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
