import { useSignals } from "@preact/signals-react/runtime";
import { useEffect, useRef, memo } from "react";
import { chatHistory, isChatLoading } from "@/store/whiteboard";
import { cn } from "@/lib/utils";
import { AgentCircle } from "./VoiceChat";
import {
	transcript,
	isTranscriptOpen,
	transcriptWidth,
	chatbot,
	latestContext,
} from "@/store/signals";
import type { Role } from "@11labs/client";

// Transcript message component from VoiceChat.tsx
const TranscriptMessage = memo(function TranscriptMessage({
	message,
	source,
}: {
	message: string;
	source: Role;
}) {
	return (
		<div
			className={cn(
				"p-2 rounded-lg text-sm",
				source === "ai"
					? "bg-blue-500/10 text-blue-200"
					: "bg-green-500/10 text-green-200",
			)}
		>
			{message}
		</div>
	);
});

// New VoiceTranscript component
const VoiceTranscript = memo(function VoiceTranscript() {
	useSignals();
	const dragRef = useRef<HTMLDivElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// Auto-scroll to bottom when new messages arrive
	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [transcript.value.length]);

	// Dragging logic
	const handleDragStart = (e: React.MouseEvent) => {
		e.preventDefault();
		const startX = e.pageX;
		const startWidth = transcriptWidth.value;

		const handleDrag = (e: MouseEvent) => {
			const delta = startX - e.pageX;
			const newWidth = Math.min(Math.max(startWidth + delta, 240), 480);
			transcriptWidth.value = newWidth;
		};

		const handleDragEnd = () => {
			document.removeEventListener("mousemove", handleDrag);
			document.removeEventListener("mouseup", handleDragEnd);
		};

		document.addEventListener("mousemove", handleDrag);
		document.addEventListener("mouseup", handleDragEnd);
	};

	if (!isTranscriptOpen.value) return null;

	return (
		<div
			className="relative border-l border-gray-700/50 bg-gray-800/30 backdrop-blur-sm flex flex-col h-full"
			style={{ width: transcriptWidth.value }}
		>
			{/* Drag handle */}
			<div
				ref={dragRef}
				className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500/20 group"
				onMouseDown={handleDragStart}
			>
				<div className="absolute left-0 top-0 bottom-0 w-0.5 bg-gray-700/50 group-hover:bg-blue-500/50" />
			</div>

			{/* Header */}
			<div className="flex-none p-4 border-b border-gray-700/50">
				<AgentCircle />
			</div>

			{/* Messages container */}
			<div className="flex-1 overflow-y-auto p-4 space-y-2">
				{transcript.value.map((msg, i) => (
					<TranscriptMessage
						key={`${msg.source}-${msg.message}-${i}`}
						message={msg.message}
						source={msg.source}
					/>
				))}
				<div ref={messagesEndRef} />
			</div>
		</div>
	);
});

// Helper to format JSON content with syntax highlighting
function formatContent(content: string) {
	try {
		// Try to parse as JSON first
		const parsed = JSON.parse(content);
		return (
			<div className="space-y-2">
				<div className="font-medium text-green-400">AI Response:</div>
				<pre className="whitespace-pre-wrap font-mono text-xs bg-gray-900/50 p-3 rounded border border-gray-700/50">
					{JSON.stringify(parsed, null, 2)}
				</pre>
			</div>
		);
	} catch {
		// If it's a formatted context (contains markdown-style headers)
		if (
			content.includes("## Task") ||
			content.includes("## Conversation History")
		) {
			return (
				<div className="space-y-4">
					<div className="font-medium text-yellow-400">System Context:</div>
					<div className="bg-gray-900/50 p-3 rounded border border-gray-700/50 space-y-4">
						{content.split("##").map((section) => {
							if (!section.trim()) return null;
							const [title, ...contentLines] = section.split("\n");
							// Use the section title as a stable key
							return (
								<div key={title.trim()} className="space-y-2">
									<div className="font-medium text-blue-400">## {title}</div>
									<pre className="whitespace-pre-wrap font-mono text-xs text-gray-300">
										{contentLines.join("\n").trim()}
									</pre>
								</div>
							);
						})}
					</div>
				</div>
			);
		}
		// Regular text
		return <span className="text-gray-300">{content}</span>;
	}
}

export function ChatPanel() {
	useSignals();

	useEffect(() => {
		// Load history and get initial context if chatbot exists
		if (chatbot.value) {
			chatHistory.value = chatbot.value.getHistory();
			// Get initial context
			chatbot.value.getFormattedContext().then((context) => {
				latestContext.value = context;
			});
		}
	}, []);

	return (
		<div className="flex flex-col h-full">
			{/* Header row */}
			<div className="flex-none h-9 border-b border-gray-700/50 bg-gray-900 px-3 flex items-center justify-between">
				<div className="text-xs font-medium text-gray-200">Context View</div>
				<div className="flex items-center gap-2">
					{isChatLoading.value && (
						<div className="text-xs text-gray-400 font-mono">
							<span className="animate-pulse">▊</span> Processing...
						</div>
					)}
				</div>
			</div>

			{/* Content row with two columns */}
			<div className="flex-1 flex min-h-0">
				{/* Context column */}
				<div className="flex-1 overflow-y-auto p-4 border-r border-gray-700/50 bg-gray-950">
					{formatContent(latestContext.value)}
				</div>
				{/* Transcript column */}
				<VoiceTranscript />
			</div>
		</div>
	);
}
