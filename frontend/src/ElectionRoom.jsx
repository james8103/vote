import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function ElectionRoom({ username, election, onExit }) {
	const [socket, setSocket] = useState(null);
	const [chat, setChat] = useState([]);
	const [message, setMessage] = useState("");
	const [balances, setBalances] = useState({});
	const [winner, setWinner] = useState(null);
	const [voteCounts, setVoteCounts] = useState({});
	const [voteThreshold, setVoteThreshold] = useState(100);
	const [voteCost, setVoteCost] = useState(50);
	const [isLoadingHistory, setIsLoadingHistory] = useState(true);
	const [votingInProgress, setVotingInProgress] = useState(false);
	const [userPayouts, setUserPayouts] = useState({});
	const [hasVoted, setHasVoted] = useState(false);

	const electionId = election._id || election.id;

	useEffect(() => {
		console.log("🔍 Election ID:", electionId);

		const s = io("https://vote-backend-jofd.onrender.com");

		s.on("connect", () => {
			console.log("✅ Socket connected");
		});

		s.on("joined", (data) => {
			console.log("✅ Joined:", data);

			// Set personalized payouts
			if (data.payouts) {
				console.log("💰 My payouts:", data.payouts);
				setUserPayouts(data.payouts);
			}

			// Set voted status
			if (data.hasVoted !== undefined) {
				setHasVoted(data.hasVoted);
			}
		});

		s.on("chat:history", (messages) => {
			console.log("📜 Received chat history:", messages.length, "messages");
			setChat(messages);
			setIsLoadingHistory(false);
		});

		s.on("chat:message", (msg) => {
			setChat((prev) => [...prev, msg]);
		});

		s.on("stake:placed", (data) => {
			console.log("✅ Vote placed:", data);
		});

		s.on("election:resolved", ({ winner, results }) => {
			console.log("🎉 Election resolved, winner:", winner);
			setWinner(winner);

			// Show payout result for this user
			if (userPayouts[winner] !== undefined) {
				const myPayout = userPayouts[winner];
				const payoutMsg =
					myPayout > 0
						? `You gained ${myPayout} coins!`
						: myPayout < 0
							? `You lost ${Math.abs(myPayout)} coins.`
							: "No change to your balance.";
				alert(`Election ended! ${winner} won. ${payoutMsg}`);
			}
		});

		s.on("votes:update", (votes) => {
			console.log("📊 Vote counts updated:", votes);
			setVoteCounts(votes);
		});

		s.on("balances:update", (users) => {
			const obj = {};
			users.forEach((u) => (obj[u.username] = u.balance));
			setBalances(obj);
		});

		console.log("🚀 Emitting join event");
		s.emit("join", { username, electionId });

		setSocket(s);

		// Fetch initial balances
		fetch("https://vote-backend-jofd.onrender.com/users")
			.then((res) => res.json())
			.then((users) => {
				const obj = {};
				users.forEach((u) => (obj[u.username] = u.balance));
				setBalances(obj);
			})
			.catch((err) => console.error("❌ Error fetching balances:", err));

		// Fetch vote info
		fetch(`https://vote-backend-jofd.onrender.com/votes/${electionId}`)
			.then((res) => res.json())
			.then((data) => {
				setVoteCounts(data.votes || {});
				setVoteThreshold(data.threshold || 100);
				setVoteCost(data.voteCost || 50);
				if (data.winner) {
					setWinner(data.winner);
				}
			})
			.catch((err) => console.error("❌ Error fetching votes:", err));

		// Fetch chat history
		fetch(`https://vote-backend-jofd.onrender.com/messages/${electionId}`)
			.then((res) => res.json())
			.then((messages) => {
				setChat((prevChat) => {
					if (prevChat.length === 0 && messages.length > 0) {
						return messages;
					}
					return prevChat;
				});
				setIsLoadingHistory(false);
			})
			.catch((err) => {
				console.error("❌ Error fetching chat:", err);
				setIsLoadingHistory(false);
			});

		// Fetch personalized payouts
		fetch(
			`https://vote-backend-jofd.onrender.com/payouts/${electionId}/${username}`,
		)
			.then((res) => res.json())
			.then((data) => {
				console.log("💰 Fetched payouts:", data.payouts);
				setUserPayouts(data.payouts);
				setHasVoted(data.hasVoted);
			})
			.catch((err) => console.error("❌ Error fetching payouts:", err));

		return () => {
			console.log("🔌 Disconnecting socket");
			s.disconnect();
		};
	}, [username, electionId]);

	const handleVote = async (candidate) => {
		if (votingInProgress || hasVoted) {
			console.log("⏳ Already voted or voting in progress");
			return;
		}

		setVotingInProgress(true);
		console.log("🗳️ Voting for:", candidate);

		try {
			const response = await fetch(
				"https://vote-backend-jofd.onrender.com/stake",
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						username,
						electionId,
						candidate,
						amount: voteCost,
					}),
				},
			);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error("❌ Vote failed:", errorData);
				alert(errorData.error || "Failed to vote");
				setVotingInProgress(false);
				return;
			}

			const data = await response.json();
			console.log("✅ Vote successful:", data);

			setHasVoted(true);

			// Update local balance
			setBalances((prev) => ({
				...prev,
				[username]: data.balance,
			}));
		} catch (err) {
			console.error("❌ Error voting:", err);
			alert("Network error: " + err.message);
		} finally {
			setVotingInProgress(false);
		}
	};

	const sendMessage = () => {
		if (message.trim() !== "") {
			socket.emit("chat:message", {
				electionId,
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

	const formatTime = (timestamp) => {
		if (!timestamp) return "";
		const date = new Date(timestamp);
		return date.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	const getPayoutColor = (payout) => {
		if (payout > 50) return "text-green-600 font-bold";
		if (payout > 0) return "text-green-500";
		if (payout === 0) return "text-gray-500";
		if (payout > -50) return "text-orange-500";
		return "text-red-600 font-bold";
	};

	return (
		<div className="p-6">
			<button onClick={onExit} className="mb-4 text-blue-600 underline">
				← Back
			</button>
			<h1 className="text-2xl font-bold mb-2">{election.title}</h1>

			{winner && (
				<div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
					<strong>🎉 Winner: {winner}!</strong>
					{userPayouts[winner] !== undefined && (
						<span className="ml-2">
							Your payout:
							<strong className={getPayoutColor(userPayouts[winner])}>
								{userPayouts[winner] > 0 ? "+" : ""}
								{userPayouts[winner]} coins
							</strong>
						</span>
					)}
				</div>
			)}

			<div className="grid grid-cols-3 gap-6">
				{/* Chat */}
				<div className="col-span-2 border rounded p-4 flex flex-col h-[500px]">
					<div className="flex-1 overflow-y-auto mb-3">
						{isLoadingHistory && (
							<p className="text-gray-500 text-sm italic">
								Loading chat history...
							</p>
						)}
						{!isLoadingHistory && chat.length === 0 && (
							<p className="text-gray-500 text-sm italic">
								No messages yet. Be the first to chat!
							</p>
						)}
						{chat.map((m, i) => (
							<div key={m._id || i} className="mb-2">
								<span className="text-xs text-gray-500 mr-2">
									{formatTime(m.time)}
								</span>
								<strong
									className={m.username === "SYSTEM" ? "text-blue-600" : ""}
								>
									{m.username}:
								</strong>{" "}
								<span
									className={m.username === "SYSTEM" ? "text-blue-600" : ""}
								>
									{m.message}
								</span>
							</div>
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

				{/* Sidebar */}
				<div>
					<div className="mb-4 p-3 bg-blue-50 rounded">
						<p className="text-sm font-semibold">Win Condition:</p>
						<p className="text-sm">First to {voteThreshold} votes wins!</p>
						<p className="text-sm mt-1 text-gray-600">
							Vote cost: {voteCost} coins
						</p>
					</div>

					{/* Your Balance */}
					<div className="mb-4 p-3 bg-gray-50 rounded">
						<p className="text-sm font-semibold">Your Balance:</p>
						<p className="text-2xl font-bold">
							{balances[username] || 0} coins
						</p>
					</div>

					<h3 className="font-semibold mb-2">Candidates:</h3>
					<ul>
						{election.candidates.map((c) => {
							const votes = voteCounts[c] || 0;
							const progress = getWinProgress(c);
							const myPayout = userPayouts[c];

							return (
								<li key={c} className="mb-4 p-3 border rounded">
									<div className="mb-2">
										<div className="flex justify-between items-center">
											<strong>{c}</strong>
											<span className="text-sm text-gray-600">
												{votes}/{voteThreshold} votes
											</span>
										</div>

										{/* Show personalized payout */}
										{myPayout !== undefined && (
											<div className="mt-1">
												<span className="text-xs text-gray-500">
													If {c} wins:{" "}
												</span>
												<span
													className={`text-sm font-semibold ${getPayoutColor(myPayout)}`}
												>
													{myPayout > 0 ? "+" : ""}
													{myPayout} coins
												</span>
											</div>
										)}
									</div>

									{/* Progress bar */}
									<div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
										<div
											className="bg-blue-600 h-2.5 rounded-full transition-all duration-300"
											style={{ width: `${progress}%` }}
										></div>
									</div>

									<button
										onClick={() => handleVote(c)}
										disabled={
											winner !== null ||
											votingInProgress ||
											hasVoted ||
											(balances[username] || 0) < voteCost
										}
										className={`w-full px-3 py-1 rounded text-sm ${
											winner || hasVoted
												? "bg-gray-300 cursor-not-allowed text-gray-600"
												: (balances[username] || 0) < voteCost
													? "bg-red-200 cursor-not-allowed text-red-800"
													: votingInProgress
														? "bg-gray-300 cursor-not-allowed"
														: "bg-green-500 text-white hover:bg-green-600"
										}`}
									>
										{winner
											? "Election Ended"
											: hasVoted
												? "Already Voted"
												: (balances[username] || 0) < voteCost
													? "Insufficient Balance"
													: votingInProgress
														? "Voting..."
														: `Vote for ${c}`}
									</button>
								</li>
							);
						})}
					</ul>

					<h3 className="font-semibold mt-4 mb-2">All Balances:</h3>
					<ul className="space-y-1 text-sm">
						{Object.entries(balances).map(([u, b]) => (
							<li key={u} className="flex justify-between">
								<span className={u === username ? "font-bold" : ""}>{u}:</span>
								<strong className={b < 0 ? "text-red-600" : ""}>{b}</strong>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
