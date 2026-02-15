import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, Election } from "./models.js";

dotenv.config();

// Connect to MongoDB
await mongoose
	.connect(process.env.MONGODB_URI)
	.then(() => console.log("✅ MongoDB connected"))
	.catch((err) => {
		console.error("MongoDB connection error:", err);
		process.exit(1);
	});

async function seedDatabase() {
	try {
		// Clear existing data
		console.log("Clearing existing data...");
		await User.deleteMany({});
		await Election.deleteMany({});

		// Insert sample users
		console.log("Creating users...");
		await User.insertMany([
			{ username: "Alice", balance: 1000 },
			{ username: "Bob", balance: 1000 },
			{ username: "Charlie", balance: 1000 },
		]);

		// Insert sample elections with vote thresholds
		console.log("Creating elections...");
		const elections = await Election.insertMany([
			{
				title: "Presidential Election",
				candidates: ["Gerry", "Alex"],
				status: "open",
				voteThreshold: 10, // Set to 10 for testing
				voteCounts: new Map([
					["Gerry", 0],
					["Alex", 0],
				]),
			},
			{
				title: "Local Council Election",
				candidates: ["Sarah", "John", "Mary"],
				status: "open",
				voteThreshold: 15,
				voteCounts: new Map([
					["Sarah", 0],
					["John", 0],
					["Mary", 0],
				]),
			},
		]);

		console.log("✅ Database seeded successfully");
		console.log(`Created ${elections.length} elections`);
	} catch (err) {
		console.error("Error seeding database:", err);
	} finally {
		mongoose.connection.close();
	}
}

seedDatabase();
