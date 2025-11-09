import React, { useEffect, useState } from "react";
import { io } from "socket.io-client";

export default function ElectionRoom({ username, election, onExit }) {
	const [socket, setSocket] = useState(null);
	const [chat, setChat] = useState([]);
	const [message, setMessage] = useState("");
	const [balances, setBalances] = useState({});
	const [winner, setWinner] = useState(null);

	useEffect(() => {
		const s = io("http://localhost:3001");
		s.emit("join", { username, electionId: election.id });

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

		s.on("balances:update", (users) => {
			const obj = {};
			users.forEach((u) => (obj[u.username] = u.balance));
			setBalances(obj);
		});

		setSocket(s);
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

	return (
		<div className="p-6">
			<button onClick={onExit} className="mb-4 text-blue-600 underline">
				← Back
			</button>
			<h1 className="text-2xl font-bold mb-2">{election.title}</h1>
			{winner && <p className="text-green-600 mb-2">Winner: {winner}</p>}

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
					<h3 className="font-semibold mb-2">Candidates:</h3>
					<ul>
						{election.candidates.map((c) => (
							<li key={c} className="mb-2">
								<button
									onClick={() =>
										fetch("http://localhost:3001/stake", {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({
												username,
												electionId: election.id,
												candidate: c,
												amount: 50,
											}),
										})
									}
									className="bg-green-500 text-white px-3 py-1 rounded"
								>
									Stake 50 on {c}
								</button>
							</li>
						))}
					</ul>

					<h3 className="font-semibold mt-4 mb-2">Balances:</h3>
					<ul>
						{Object.entries(balances).map(([u, b]) => (
							<li key={u}>
								{u}: <strong>{b}</strong>
							</li>
						))}
					</ul>
				</div>
			</div>
		</div>
	);
}
