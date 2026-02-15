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
	const [isLoadingHistory, setIsLoadingHistory] = useState(true);
	const [votingInProgress, setVotingInProgress] = useState(false);

	// Get the correct election ID
	const electionId = election._id || election.id;

	useEffect(() => {
		console.log("🔍 Election ID being used:", electionId);

		// Connect to your Render backend
		const s = io("https://vote-backend-jofd.onrender.com");

		s.on("connect", () => {
			console.log("✅ Socket connected");
		});

		s.on("joined", (data) => {
			console.log("✅ Joined:", data);
		});

		// Listen for chat history when joining
		s.on("chat:history", (messages) => {
			console.log("📜 Received chat history:", messages.length, "messages");
			setChat(messages);
			setIsLoadingHistory(false);
		});

		s.on("chat:message", (msg) => {
			console.log("💬 New message:", msg);
			setChat((prev) => [...prev, msg]);
		});

		s.on("stake:placed", (data) => {
			console.log("✅ Stake placed:", data);
		});

		s.on("election:resolved", ({ winner, results }) => {
			console.log("🎉 Election resolved, winner:", winner);
			setWinner(winner);
		});

		// Listen for vote count updates
		s.on("votes:update", (votes) => {
			console.log("📊 Vote counts updated:", votes);
			setVoteCounts(votes);
		});

		// Listen for balances updates from backend
		s.on("balances:update", (users) => {
			const obj = {};
			users.forEach((u) => (obj[u.username] = u.balance));
			setBalances(obj);
		});

		console.log("🚀 Emitting join event with electionId:", electionId);
		s.emit("join", { username, electionId });

		setSocket(s);

		// Fetch initial balances on mount
		fetch("https://vote-backend-jofd.onrender.com/users")
			.then((res) => res.json())
			.then((users) => {
				const obj = {};
				users.forEach((u) => (obj[u.username] = u.balance));
				setBalances(obj);
			})
			.catch((err) =>
				console.error("❌ Error fetching initial balances:", err),
			);

		// Fetch initial vote counts
		const votesUrl = `https://vote-backend-jofd.onrender.com/votes/${electionId}`;
		console.log("🔍 Fetching votes from:", votesUrl);
		fetch(votesUrl)
			.then((res) => {
				if (!res.ok) {
					throw new Error(`HTTP ${res.status}`);
				}
				return res.json();
			})
			.then((data) => {
				console.log("📊 Vote data:", data);
				setVoteCounts(data.votes || {});
				setVoteThreshold(data.threshold || 100);
				if (data.winner) {
					setWinner(data.winner);
				}
			})
			.catch((err) => console.error("❌ Error fetching vote counts:", err));

		// Fetch chat history (backup method if socket doesn't deliver)
		const messagesUrl = `https://vote-backend-jofd.onrender.com/messages/${electionId}`;
		console.log("🔍 Fetching messages from:", messagesUrl);

		fetch(messagesUrl)
			.then((res) => {
				console.log("📡 Messages response status:", res.status);
				if (!res.ok) {
					throw new Error(`HTTP ${res.status}`);
				}
				return res.json();
			})
			.then((messages) => {
				console.log(
					"📜 Fetched messages via HTTP:",
					messages.length,
					"messages",
				);

				// Only set if we haven't received via socket yet
				setChat((prevChat) => {
					if (prevChat.length === 0 && messages.length > 0) {
						console.log("✅ Setting chat from HTTP response");
						return messages;
					}
					return prevChat;
				});
				setIsLoadingHistory(false);
			})
			.catch((err) => {
				console.error("❌ Error fetching chat history:", err);
				setIsLoadingHistory(false);
			});

		return () => {
			console.log("🔌 Disconnecting socket");
			s.disconnect();
		};
	}, [username, electionId]);

	const handleVote = async (candidate) => {
		if (votingInProgress) {
			console.log("⏳ Vote already in progress, ignoring");
			return;
		}

		setVotingInProgress(true);
		console.log("🗳️ Voting for:", candidate, "with electionId:", electionId);

		try {
			const response = await fetch(
				"https://vote-backend-jofd.onrender.com/stake",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						username,
						electionId,
						candidate,
						amount: 50,
					}),
				},
			);

			console.log("📡 Stake response status:", response.status);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				console.error("❌ Stake failed:", errorData);
				alert(errorData.error || "Failed to place vote");
				setVotingInProgress(false);
				return;
			}

			const data = await response.json();
			console.log("✅ Stake successful:", data);

			// Update local balance immediately
			setBalances((prev) => ({
				...prev,
				[username]: data.balance,
			}));

			// Force pull balances from server as backup
			fetch("https://vote-backend-jofd.onrender.com/users")
				.then((res) => res.json())
				.then((users) => {
					const obj = {};
					users.forEach((u) => (obj[u.username] = u.balance));
					setBalances(obj);
				})
				.catch((err) =>
					console.error("❌ Error fetching updated balances:", err),
				);
		} catch (err) {
			console.error("❌ Error placing stake:", err);
			alert("Network error: " + err.message);
		} finally {
			setVotingInProgress(false);
		}
	};

	const sendMessage = () => {
		if (message.trim() !== "") {
			console.log("📤 Sending message to electionId:", electionId);
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
										onClick={() => handleVote(c)}
										disabled={winner !== null || votingInProgress}
										className={`w-full px-3 py-1 rounded ${
											winner || votingInProgress
												? "bg-gray-300 cursor-not-allowed"
												: "bg-green-500 text-white hover:bg-green-600"
										}`}
									>
										{winner
											? "Election Ended"
											: votingInProgress
												? "Voting..."
												: `Vote for ${c} (50 coins)`}
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
