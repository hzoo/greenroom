import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import tailwindcss from "@tailwindcss/vite";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
	plugins: [react(), tailwindcss()],
	resolve: {
		alias: {
			"@": "/src",
		},
	},
	build: {
		rollupOptions: {
			input: {
				main: resolve(__dirname, "index.html"),
				voice: resolve(__dirname, "src/voice-chat/index.html"),
			},
		},
	},
	server: {
		proxy: {
			"/api": {
				target: "http://localhost:3000",
				changeOrigin: true,
				secure: false,
			},
		},
		watch: {
			ignored: ["**/shapes.json", "**/.chat_history.json"],
		},
	},
});
