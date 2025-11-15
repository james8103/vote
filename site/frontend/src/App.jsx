import React, { useState } from "react";
import Home from "./Home";
import ElectionRoom from "./ElectionRoom";

export default function App() {
	const [username, setUsername] = useState(
		localStorage.getItem("username") || ""
	);
	const [election, setElection] = useState(null);

	if (!username)
		return (
			<Home
				onJoin={(name) => {
					localStorage.setItem("username", name);
					setUsername(name);
				}}
			/>
		);

	if (!election)
		return <ElectionList username={username} onSelect={setElection} />;

	return (
		<ElectionRoom
			username={username}
			election={election}
			onExit={() => setElection(null)}
		/>
	);
}

function ElectionList({ username, onSelect }) {
	const [elections, setElections] = React.useState([]);

	React.useEffect(() => {
		fetch("http://localhost:3001/elections")
			.then((res) => res.json())
			.then(setElections);
	}, []);

	return (
		<div className="p-6">
			<h1 className="text-2xl font-bold mb-4">Welcome, {username}!</h1>
			<h2 className="text-xl mb-2">Available Elections:</h2>
			<ul>
				{elections.map((e) => (
					<li key={e.id} className="border p-3 mb-3 rounded">
						<p className="font-semibold">{e.title}</p>
						<button
							onClick={() => onSelect(e)}
							className="mt-2 bg-blue-500 text-white px-3 py-1 rounded"
						>
							Join
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
