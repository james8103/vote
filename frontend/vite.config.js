import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// IMPORTANT: GitHub Pages repo name
const repoName = "vote";

export default defineConfig({
	plugins: [react()],
	base: `/${repoName}/`,
	build: {
		outDir: "dist",
	},
});
