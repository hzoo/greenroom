import { signal } from "@preact/signals-react";
import { Conversation } from "@11labs/client";
import { useEffect } from "react";
import { cn } from "@/lib/utils";

const conversation = signal<Conversation | null>(null);
const isConnected = signal(false);
const isSpeaking = signal(false);
const agentName = signal<string>("");

const buttonStyles =
	"w-full px-3 py-2 text-sm rounded-md border border-gray-200/20 hover:bg-gray-700/50 transition-colors";

async function requestMicrophonePermission() {
	try {
		await navigator.mediaDevices.getUserMedia({ audio: true });
		return true;
	} catch (error) {
		console.error("Microphone permission denied:", error);
		return false;
	}
}

async function getSignedUrl(agentId: string) {
	try {
		const response = await fetch(
			`/api/elevenlabs/signed-url?agentId=${agentId}`,
		);
		if (!response.ok) throw new Error("Failed to get signed URL");
		const data = await response.json();
		return data.signedUrl;
	} catch (error) {
		console.error("Error getting signed URL:", error);
		throw error;
	}
}

async function createAgent(name: string, prompt: string) {
	try {
		const response = await fetch("/api/elevenlabs/agents", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ name, prompt }),
		});
		if (!response.ok) throw new Error("Failed to create agent");
		const data = await response.json();
		return data.agentId;
	} catch (error) {
		console.error("Error creating agent:", error);
		throw error;
	}
}

export function VoiceChat() {
	useEffect(() => {
		// Get agent ID from URL parameters
		const params = new URLSearchParams(window.location.search);
		const agentId = params.get("agentId");
		const name = params.get("name");
		if (name) {
			agentName.value = decodeURIComponent(name);
		}

		// If no agent ID, create a new agent
		if (!agentId) {
			createAgent(
				"Test Agent",
				"You are a helpful AI assistant. Be concise and friendly.",
			)
				.then((newAgentId) => {
					// Update URL with new agent ID
					const newUrl = new URL(window.location.href);
					newUrl.searchParams.set("agentId", newAgentId);
					window.history.replaceState({}, "", newUrl);
				})
				.catch((error) => {
					console.error("Failed to create agent:", error);
					alert("Failed to create agent. Please try again.");
				});
		}
	}, []);

	async function startConversation() {
		try {
			const hasPermission = await requestMicrophonePermission();
			if (!hasPermission) {
				alert("Microphone permission is required for the conversation.");
				return;
			}

			const params = new URLSearchParams(window.location.search);
			const agentId = params.get("agentId");
			if (!agentId) {
				alert("No agent ID found. Please try refreshing the page.");
				return;
			}

			const signedUrl = await getSignedUrl(agentId);
			const conv = await Conversation.startSession({
				signedUrl,
				onConnect: () => {
					isConnected.value = true;
					isSpeaking.value = true;
				},
				onDisconnect: () => {
					isConnected.value = false;
					isSpeaking.value = false;
				},
				onError: (error) => {
					console.error("Conversation error:", error);
					alert("An error occurred during the conversation.");
				},
				onModeChange: (mode) => {
					isSpeaking.value = mode.mode === "speaking";
				},
			});
			conversation.value = conv;
		} catch (error) {
			console.error("Error starting conversation:", error);
			alert("Failed to start conversation. Please try again.");
		}
	}

	async function endConversation() {
		if (conversation.value) {
			await conversation.value.endSession();
			conversation.value = null;
		}
	}

	useEffect(() => {
		return () => {
			if (conversation.value) {
				conversation.value.endSession();
			}
		};
	}, []);

	return (
		<div className="flex flex-col h-screen bg-gray-900 text-gray-100">
			<div className="flex justify-between items-center p-2 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
				<h2 className="text-sm font-medium text-gray-300">
					{agentName.value || "Voice Chat"}
				</h2>
				<div className="text-xs text-gray-400 font-mono">
					{isConnected.value
						? isSpeaking.value
							? "Agent Speaking"
							: "Agent Listening"
						: "Disconnected"}
				</div>
			</div>

			<div className="flex-1 flex items-center justify-center p-4">
				<div className="w-full max-w-sm space-y-4">
					<div className="flex justify-center">
						<div
							className={cn(
								"h-24 w-24 rounded-full transition-all duration-300",
								isConnected.value
									? isSpeaking.value
										? "bg-blue-500/20 animate-pulse"
										: "bg-green-500/20"
									: "bg-gray-700/20",
								"border border-gray-200/10",
							)}
						/>
					</div>

					<div className="flex flex-col gap-2">
						<button
							onClick={startConversation}
							disabled={conversation.value !== null && isConnected.value}
							className={cn(
								buttonStyles,
								"text-blue-200/70 hover:text-blue-200 disabled:opacity-50 disabled:hover:bg-transparent",
							)}
						>
							Start Conversation
						</button>
						<button
							onClick={endConversation}
							disabled={conversation.value === null && !isConnected.value}
							className={cn(
								buttonStyles,
								"text-red-200/70 hover:text-red-200 disabled:opacity-50 disabled:hover:bg-transparent",
							)}
						>
							End Conversation
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
