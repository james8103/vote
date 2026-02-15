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
			await mongoose.connection.collection("stakes").deleteMany({});
			await mongoose.connection.collection("messages").deleteMany({});
		} catch (err) {
			console.log("Collections don't exist yet (this is fine)");
		}

		// Insert sample users with base balance
		console.log("Creating users...");
		await User.insertMany([
			{ username: "Alice", balance: 1000 },
			{ username: "Bob", balance: 1000 },
			{ username: "Charlie", balance: 1000 },
			{ username: "Diana", balance: 1000 },
			{ username: "Eve", balance: 1000 },
			{ username: "Frank", balance: 1000 },
		]);

		// Create diverse sample elections
		console.log("Creating elections...");
		const elections = await Election.insertMany([
			{
				title: "University Budget Allocation",
				description:
					"Decide where the student activity fund should be allocated for next semester.",
				candidates: ["Sports Programs", "Arts & Culture", "Technology Labs"],
				status: "open",
				voteThreshold: 10,
				entryBonus: 200,
				voteCost: 50,
				isVisible: true, // Currently active
				voteCounts: new Map([
					["Sports Programs", 0],
					["Arts & Culture", 0],
					["Technology Labs", 0],
				]),
			},
			{
				title: "Company Retreat Location",
				description:
					"Vote on where our annual company retreat should be held this year.",
				candidates: [
					"Beach Resort",
					"Mountain Lodge",
					"City Hotel",
					"Countryside Villa",
				],
				status: "open",
				voteThreshold: 12,
				entryBonus: 250,
				voteCost: 60,
				isVisible: true,
				voteCounts: new Map([
					["Beach Resort", 0],
					["Mountain Lodge", 0],
					["City Hotel", 0],
					["Countryside Villa", 0],
				]),
			},
			{
				title: "Next Movie Night Selection",
				description:
					"Choose which movie we'll watch at the community movie night.",
				candidates: ["Action Thriller", "Romantic Comedy", "Sci-Fi"],
				status: "open",
				voteThreshold: 8,
				entryBonus: 150,
				voteCost: 40,
				isVisible: true,
				voteCounts: new Map([
					["Action Thriller", 0],
					["Romantic Comedy", 0],
					["Sci-Fi", 0],
				]),
			},
			{
				title: "Office Renovation Priority",
				description: "What should we renovate first in our office space?",
				candidates: [
					"Break Room",
					"Conference Rooms",
					"Open Work Areas",
					"Private Offices",
				],
				status: "open",
				voteThreshold: 15,
				entryBonus: 300,
				voteCost: 70,
				isVisible: false, // Hidden - not ready yet
				voteCounts: new Map([
					["Break Room", 0],
					["Conference Rooms", 0],
					["Open Work Areas", 0],
					["Private Offices", 0],
				]),
			},
			{
				title: "Charity Fundraiser Theme",
				description: "Pick the theme for our annual charity gala event.",
				candidates: ["Masquerade Ball", "Casino Night", "Garden Party"],
				status: "open",
				voteThreshold: 10,
				entryBonus: 200,
				voteCost: 50,
				isVisible: false, // Hidden - scheduled for later
				startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Starts in 1 week
				voteCounts: new Map([
					["Masquerade Ball", 0],
					["Casino Night", 0],
					["Garden Party", 0],
				]),
			},
			{
				title: "Weekend Team Activity",
				description: "Vote on our team building activity for next weekend.",
				candidates: ["Hiking Trip", "Escape Room", "Bowling", "Cooking Class"],
				status: "open",
				voteThreshold: 8,
				entryBonus: 180,
				voteCost: 45,
				isVisible: true,
				voteCounts: new Map([
					["Hiking Trip", 0],
					["Escape Room", 0],
					["Bowling", 0],
					["Cooking Class", 0],
				]),
			},
			{
				title: "New Product Feature Priority",
				description: "Which feature should our development team prioritize?",
				candidates: [
					"Dark Mode",
					"Mobile App",
					"API Integration",
					"Analytics Dashboard",
				],
				status: "open",
				voteThreshold: 12,
				entryBonus: 250,
				voteCost: 60,
				isVisible: true,
				voteCounts: new Map([
					["Dark Mode", 0],
					["Mobile App", 0],
					["API Integration", 0],
					["Analytics Dashboard", 0],
				]),
			},
			{
				title: "Holiday Party Date",
				description: "When should we schedule our holiday party?",
				candidates: [
					"First Week December",
					"Second Week December",
					"Third Week December",
				],
				status: "open",
				voteThreshold: 10,
				entryBonus: 200,
				voteCost: 50,
				isVisible: false, // Hidden - planning phase
				voteCounts: new Map([
					["First Week December", 0],
					["Second Week December", 0],
					["Third Week December", 0],
				]),
			},
			{
				title: "Lunch Vendor Selection",
				description: "Choose our new weekly catered lunch vendor.",
				candidates: [
					"Italian Bistro",
					"Asian Fusion",
					"Mexican Grill",
					"Mediterranean Cafe",
				],
				status: "open",
				voteThreshold: 8,
				entryBonus: 150,
				voteCost: 40,
				isVisible: true,
				voteCounts: new Map([
					["Italian Bistro", 0],
					["Asian Fusion", 0],
					["Mexican Grill", 0],
					["Mediterranean Cafe", 0],
				]),
			},
			{
				title: "Team Mascot Design",
				description: "Vote on the design for our new team mascot!",
				candidates: ["Phoenix", "Dragon", "Eagle", "Lion"],
				status: "open",
				voteThreshold: 10,
				entryBonus: 200,
				voteCost: 50,
				isVisible: false, // Hidden - contest not announced yet
				voteCounts: new Map([
					["Phoenix", 0],
					["Dragon", 0],
					["Eagle", 0],
					["Lion", 0],
				]),
			},
		]);

		console.log("✅ Database seeded successfully");
		console.log(`\nCreated ${elections.length} elections:`);
		console.log(`  - ${elections.filter((e) => e.isVisible).length} visible`);
		console.log(`  - ${elections.filter((e) => !e.isVisible).length} hidden`);
		console.log(`\nCreated ${await User.countDocuments()} users`);

		console.log("\n📊 Election Summary:");
		for (const election of elections) {
			const visibilityIcon = election.isVisible ? "👁️ " : "🔒";
			console.log(`  ${visibilityIcon} ${election.title}`);
			console.log(`     - ${election.candidates.length} candidates`);
			console.log(`     - Win threshold: ${election.voteThreshold} votes`);
			console.log(`     - Entry bonus: ${election.entryBonus} coins`);
			console.log(`     - Vote cost: ${election.voteCost} coins`);
			console.log(`     - Visible: ${election.isVisible ? "Yes" : "No"}`);
			console.log("");
		}
	} catch (err) {
		console.error("Error seeding database:", err);
	} finally {
		mongoose.connection.close();
	}
}

seedDatabase();
