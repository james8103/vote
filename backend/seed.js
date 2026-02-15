import mongoose from "mongoose";
import dotenv from "dotenv";
import { User, Election } from "./models.js";

dotenv.config();

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

		// Also clear UserElection collection if it exists
		try {
			await mongoose.connection.collection("userelections").deleteMany({});
		} catch (err) {
			console.log("UserElection collection doesn't exist yet (this is fine)");
		}

		// Insert sample users with base balance
		console.log("Creating users...");
		await User.insertMany([
			{ username: "Alice", balance: 1000 },
			{ username: "Bob", balance: 1000 },
			{ username: "Charlie", balance: 1000 },
			{ username: "Diana", balance: 1000 },
		]);

		// Create election with game theory settings
		console.log("Creating election...");
		const elections = await Election.insertMany([
			{
				title: "Budget Allocation Vote",
				candidates: ["Education", "Healthcare", "Infrastructure"],
				status: "open",
				voteThreshold: 8, // Lower for testing
				entryBonus: 200, // Bonus coins on first join
				voteCost: 50, // Cost to vote
				voteCounts: new Map([
					["Education", 0],
					["Healthcare", 0],
					["Infrastructure", 0],
				]),
			},
		]);

		console.log("✅ Database seeded successfully");
		console.log(`Created ${elections.length} election(s)`);
		console.log("\nElection Details:");
		console.log("- Entry Bonus: 200 coins (one-time)");
		console.log("- Vote Cost: 50 coins");
		console.log("- Vote Threshold: 8 votes to win");
		console.log("\nPersonalized payouts will be generated when users join!");
	} catch (err) {
		console.error("Error seeding database:", err);
	} finally {
		mongoose.connection.close();
	}
}

seedDatabase();
