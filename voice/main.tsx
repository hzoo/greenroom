import React from "react";
import ReactDOM from "react-dom/client";
import { VoiceChat } from "@/components/VoiceChat";
import "@/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
	<React.StrictMode>
		<VoiceChat />
	</React.StrictMode>,
);
