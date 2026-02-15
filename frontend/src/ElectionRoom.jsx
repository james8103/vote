import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function ElectionRoom({ username, election, onExit }) {
	const [socket, setSocket] = useState(null);
	const [chat, setChat] = useState([]);
	const [message, setMessage] = useState("");
	const [balances, setBalances] = useState({});
	const [winner, setWinner] = useState(null);
	const [voteCounts, setVoteCounts] = useState({});
	const [voteThreshold, setVoteThreshold] = useState(100); // Default win threshold

	useEffect(() => {
		// Connect to your Render backend
		const s = io("https://vote-backend-jofd.onrender.com");

		s.on("joined", (data) => {
			console.log("Joined:", data);
		});

		s.on("chat:message", (msg) => {
			setChat((prev) => [...prev, msg]);
		});

		s.on("stake:placed", (data) => {
			console.log("Stake placed", data);
		});

		s.on("election:resolved", ({ winner, results }) => {
			setWinner(winner);
		});

		// Listen for vote count updates
		s.on("votes:update", (votes) => {
			setVoteCounts(votes);
		});

		// Listen for balances updates from backend
		s.on("balances:update", (users) => {
			const obj = {};
			users.forEach((u) => (obj[u.username] = u.balance));
			setBalances(obj);
		});

		s.emit("join", { username, electionId: election.id });

		setSocket(s);

		// Fetch initial balances on mount
		fetch("https://vote-backend-jofd.onrender.com/users")
			.then((res) => res.json())
			.then((users) => {
				const obj = {};
				users.forEach((u) => (obj[u.username] = u.balance));
				setBalances(obj);
			})
			.catch((err) => console.error("Error fetching initial balances:", err));

		// Fetch initial vote counts
		fetch(`https://vote-backend-jofd.onrender.com/votes/${election.id}`)
			.then((res) => res.json())
			.then((data) => {
				setVoteCounts(data.votes || {});
				setVoteThreshold(data.threshold || 100);
			})
			.catch((err) => console.error("Error fetching vote counts:", err));

		return () => s.disconnect();
	}, [username, election.id]);

	const sendMessage = () => {
		if (message.trim() !== "") {
			socket.emit("chat:message", {
				electionId: election.id,
				username,
				message,
			});
			setMessage("");
		}
	};

	const getWinProgress = (candidate) => {
		const votes = voteCounts[candidate] || 0;
		return Math.min((votes / voteThreshold) * 100, 100);
	};

	return (
		<div className="p-6">
			<button onClick={onExit} className="mb-4 text-blue-600 underline">
				← Back
			</button>
			<h1 className="text-2xl font-bold mb-2">{election.title}</h1>
			{winner && (
				<div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
					<strong>🎉 Winner: {winner}!</strong> They reached {voteThreshold}{" "}
					votes!
				</div>
			)}

			<div className="grid grid-cols-3 gap-6">
				{/* Chat */}
				<div className="col-span-2 border rounded p-4 flex flex-col h-[400px]">
					<div className="flex-1 overflow-y-auto mb-3">
						{chat.map((m, i) => (
							<p key={i}>
								<strong>{m.username}:</strong> {m.message}
							</p>
						))}
					</div>
					<div className="flex gap-2">
						<input
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							onKeyDown={(e) => e.key === "Enter" && sendMessage()}
							placeholder="Type message..."
							className="flex-1 border rounded px-2 py-1"
						/>
						<button
							onClick={sendMessage}
							className="bg-blue-500 text-white px-3 rounded"
						>
							Send
						</button>
					</div>
				</div>

				{/* Sidebar: candidates + balances */}
				<div>
					<div className="mb-4 p-3 bg-blue-50 rounded">
						<p className="text-sm font-semibold">Win Condition:</p>
						<p className="text-sm">First to {voteThreshold} votes wins!</p>
					</div>

					<h3 className="font-semibold mb-2">Candidates:</h3>
					<ul>
						{election.candidates.map((c) => {
							const votes = voteCounts[c] || 0;
							const progress = getWinProgress(c);

							return (
								<li key={c} className="mb-4 p-3 border rounded">
									<div className="flex justify-between items-center mb-2">
										<strong>{c}</strong>
										<span className="text-sm text-gray-600">
											{votes}/{voteThreshold} votes
										</span>
									</div>

									{/* Progress bar */}
									<div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
										<div
											className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
											style={{ width: `${progress}%` }}
										></div>
									</div>

									<button
										onClick={() => {
											fetch("https://vote-backend-jofd.onrender.com/stake", {
												method: "POST",
												headers: { "Content-Type": "application/json" },
												body: JSON.stringify({
													username,
													electionId: election.id,
													candidate: c,
													amount: 50,
												}),
											}).then(() => {
												// Force pull balances if websocket missed an event
												fetch("https://vote-backend-jofd.onrender.com/users")
													.then((res) => res.json())
													.then((users) => {
														const obj = {};
														users.forEach((u) => (obj[u.username] = u.balance));
														setBalances(obj);
													});
											});
										}}
										disabled={winner !== null}
										className={`w-full px-3 py-1 rounded ${
											winner
												? "bg-gray-300 cursor-not-allowed"
												: "bg-green-500 text-white hover:bg-green-600"
										}`}
									>
										{winner ? "Election Ended" : `Vote for ${c} (50 coins)`}
									</button>
								</li>
							);
						})}
					</ul>

					<h3 className="font-semibold mt-4 mb-2">Balances:</h3>
					<ul className="space-y-1">
						{Object.entries(balances).map(([u, b]) => (
							<li key={u} className="flex justify-between">
								<span>{u}:</span>
								<strong>{b} coins</strong>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
