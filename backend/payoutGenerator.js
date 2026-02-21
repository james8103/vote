export function generateUserPayouts(candidates, userIndex = 0) {
	const payouts = {};
	const numCandidates = candidates.length;

	// Each user gets a different "favorite" candidate
	const favoriteIndex = userIndex % numCandidates;

	// Assign payouts to each candidate
	candidates.forEach((candidate, index) => {
		if (index === favoriteIndex) {
			// This is their favourite - big win!
			payouts[candidate] = 150;
		} else {
			// Other candidates: rotate through different outcomes
			const position = (index + userIndex) % 4;

			if (position === 0) {
				payouts[candidate] = 60; //Medium win
			} else if (position === 1) {
				payouts[candidate] = 20; //Small win
			} else if (position === 2) {
				payouts[candidate] = -30; //Small loss
			} else {
				payouts[candidate] = -70; //Big loss
			}
		}
	});

	return payouts;
}

export function getUserIndex(username) {
	let hash = 0;

	//Convert username to a number or index by summing char codes
	for (let i = 0; i < username.length; i++) {
		hash = hash + username.charCodeAt(i);
	}

	return hash;
}
