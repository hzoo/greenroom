import React from "react";
import { createRoot } from "react-dom/client";
import { Agent } from "@/components/Agent";
import "@/index.css";

const root = createRoot(document.getElementById("root")!);
root.render(
	<React.StrictMode>
		<Agent />
	</React.StrictMode>,
);
