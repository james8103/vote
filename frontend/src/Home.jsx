import React, { useState } from "react";

export default function Home({ onJoin }) {
	const [name, setName] = useState("");

	return (
		<div className="flex flex-col items-center justify-center h-screen gap-4">
			<h1 className="text-3xl font-bold">Election Simulator</h1>
			<input
				type="text"
				placeholder="Enter your name"
				value={name}
				onChange={(e) => setName(e.target.value)}
				className="border rounded px-3 py-2"
			/>
			<button
				onClick={() => name && onJoin(name)}
				className="bg-green-600 text-white px-4 py-2 rounded"
			>
				Join
			</button>
		</div>
	);
}
