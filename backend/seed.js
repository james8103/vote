import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

// Connect to Atlas using your environment variable
await mongoose
	.connect(process.env.MONGODB_URI)
	.then(() => console.log("✅ MongoDB connected"))
	.catch((err) => console.error("MongoDB connection error:", err));

// Define schemas
const userSchema = new mongoose.Schema({
	username: { type: String, unique: true },
	balance: { type: Number, default: 1000 },
});

const electionSchema = new mongoose.Schema({
	id: String,
	title: String,
	candidates: [String],
	status: { type: String, default: "open" },
	winner: { type: String, default: null },
<<<<<<< HEAD
	voteThreshold: { type: Number, default: 100 },
	voteCounts: {
		type: Map,
		of: Number,
		default: {},
	},
=======
>>>>>>> 09fa173ee913298eb7b0d7f230c8856fe84a72c2
});

const User = mongoose.model("User", userSchema);
const Election = mongoose.model("Election", electionSchema);

// Clear existing data (optional)
await User.deleteMany({});
await Election.deleteMany({});

// Insert sample users
await User.insertMany([
	{ username: "Alice", balance: 1000 },
	{ username: "Bob", balance: 1000 },
	{ username: "Charlie", balance: 1000 },
]);

<<<<<<< HEAD
// Insert sample elections with vote thresholds
=======
// Insert sample elections
>>>>>>> 09fa173ee913298eb7b0d7f230c8856fe84a72c2
await Election.insertMany([
	{
		id: "1",
		title: "Presidential Election",
		candidates: ["Gerry", "Alex"],
		status: "open",
<<<<<<< HEAD
		voteThreshold: 10, // Set to 10 for testing, increase for production
		voteCounts: new Map([
			["Gerry", 0],
			["Alex", 0],
		]),
=======
>>>>>>> 09fa173ee913298eb7b0d7f230c8856fe84a72c2
	},
	{
		id: "2",
		title: "Local Council Election",
		candidates: ["Sarah", "John", "Mary"],
		status: "open",
<<<<<<< HEAD
		voteThreshold: 15,
		voteCounts: new Map([
			["Sarah", 0],
			["John", 0],
			["Mary", 0],
		]),
=======
>>>>>>> 09fa173ee913298eb7b0d7f230c8856fe84a72c2
	},
]);

console.log("✅ Database seeded successfully");
mongoose.connection.close();
