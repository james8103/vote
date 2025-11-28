import { useState } from "react";

export default function App() {
	const [count, setCount] = useState(0);

	return (
		<div style={{ padding: 40 }}>
			<h1>Voting Site Frontend</h1>
			<p>This is a clean working Vite + React setup.</p>

			<button onClick={() => setCount(count + 1)}>Clicks: {count}</button>
		</div>
	);
}
