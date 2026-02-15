// Payout Generation Utility
// Creates interesting game theory dynamics for elections

/**
 * Generates personalized payouts for a user in an election
 * Strategy: Create diverse incentives with a Nash equilibrium tendency
 *
 * @param {Array<string>} candidates - List of candidate names
 * @param {number} userIndex - Index of this user (for variety)
 * @returns {Object} - Map of candidate names to payout amounts
 */
export function generatePayouts(candidates, userIndex = 0) {
	const payouts = {};
	const numCandidates = candidates.length;

	// Base ranges for payouts (adjustable for balance)
	const highWin = 150; // Maximum win
	const mediumWin = 60; // Medium win
	const smallWin = 20; // Small win
	const smallLoss = -30; // Small loss
	const bigLoss = -80; // Big loss

	// Assign one candidate as this user's "best choice" (cycles through candidates)
	const bestCandidateIndex = userIndex % numCandidates;

	candidates.forEach((candidate, index) => {
		if (index === bestCandidateIndex) {
			// This is their best candidate - high reward
			payouts[candidate] = highWin + randomVariance(20);
		} else {
			// Other candidates get varied payouts
			const distribution = [
				mediumWin + randomVariance(15), // Compromise option
				smallWin + randomVariance(10), // Safe option
				smallLoss + randomVariance(10), // Risky option
				bigLoss + randomVariance(15), // Bad option
			];

			// Use hash of username + candidate to get consistent but varied results
			const hash = (userIndex * 7 + index * 13) % distribution.length;
			payouts[candidate] = distribution[hash];
		}
	});

	// Ensure at least one candidate has positive payout
	const allNegative = Object.values(payouts).every((v) => v <= 0);
	if (allNegative) {
		// Make the "best" candidate positive
		const bestCandidate = candidates[bestCandidateIndex];
		payouts[bestCandidate] = Math.abs(payouts[bestCandidate]) + 30;
	}

	return payouts;
}

/**
 * Alternative: Generate payouts with explicit Nash equilibrium
 * One candidate is the "stable" choice that most people find acceptable
 */
export function generatePayoutsWithEquilibrium(candidates, userIndex = 0) {
	const payouts = {};
	const numCandidates = candidates.length;

	// Designate one candidate as the "equilibrium" (middle candidate)
	const equilibriumIndex = Math.floor(numCandidates / 2);

	// Each user gets one "favorite" candidate (high payout)
	const favoriteIndex = userIndex % numCandidates;

	candidates.forEach((candidate, index) => {
		if (index === favoriteIndex) {
			// Their favorite - highest reward but varies by user
			payouts[candidate] = 120 + randomVariance(40);
		} else if (index === equilibriumIndex) {
			// Equilibrium candidate - always moderate positive for everyone
			payouts[candidate] = 40 + randomVariance(15);
		} else {
			// Other candidates - mix of small gains and losses
			const options = [
				-60 + randomVariance(20), // Big loss
				-20 + randomVariance(10), // Small loss
				10 + randomVariance(5), // Tiny gain
				50 + randomVariance(15), // Medium gain
			];
			const hash = (userIndex * 11 + index * 17) % options.length;
			payouts[candidate] = options[hash];
		}
	});

	return payouts;
}

/**
 * Zero-sum style: Create competitive dynamics where gains/losses balance
 * Not truly zero-sum (to keep it interesting) but creates tension
 */
export function generateCompetitivePayouts(candidates, userIndex = 0) {
	const payouts = {};

	// Rotate which candidate is best for each user
	const bestIndex = userIndex % candidates.length;
	const worstIndex = (userIndex + 1) % candidates.length;

	candidates.forEach((candidate, index) => {
		if (index === bestIndex) {
			payouts[candidate] = 150 + randomVariance(30);
		} else if (index === worstIndex) {
			payouts[candidate] = -70 + randomVariance(20);
		} else {
			// Others are moderate
			payouts[candidate] = 25 + randomVariance(20);
		}
	});

	return payouts;
}

/**
 * Add random variance to make payouts less predictable
 */
function randomVariance(maxVariance) {
	return Math.floor(Math.random() * maxVariance * 2) - maxVariance;
}

/**
 * Get a user index based on their username (for consistency)
 */
export function getUserIndex(username) {
	// Simple hash function to convert username to a consistent number
	let hash = 0;
	for (let i = 0; i < username.length; i++) {
		hash = (hash << 5) - hash + username.charCodeAt(i);
		hash = hash & hash; // Convert to 32bit integer
	}
	return Math.abs(hash);
}

// Export the strategy we want to use (can be changed easily)
export const generateUserPayouts = generatePayoutsWithEquilibrium;
