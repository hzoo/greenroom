import { useSignals } from "@preact/signals-react/runtime";
import {
	elapsedTime,
	isDebugOpen,
	isPlaying,
	resetTimeline,
	togglePlayback,
} from "@/store/whiteboard";
import { cn } from "@/lib/utils";
import {
	isMockMode,
	mockMessages,
	currentMockIndex,
	transcript,
	isUserSpeaking,
	isAgentSpeaking,
} from "@/store/signals";
import { batch } from "@preact/signals-react";

const buttonStyles =
	"px-2 py-1 text-sm rounded-md border border-gray-200/20 hover:bg-gray-700/50 transition-colors";

const formatTime = (time: number) => time.toFixed(1).padStart(4, " ");

// Mock conversation handler
function handleMockConversation() {
	if (currentMockIndex.value >= mockMessages.value.length - 1) {
		currentMockIndex.value = -1;
		return;
	}

	currentMockIndex.value++;
	const currentMessage = mockMessages.value[currentMockIndex.value];

	batch(() => {
		transcript.value = [...transcript.value, currentMessage];

		if (currentMessage.source === "user") {
			isUserSpeaking.value = true;
			isAgentSpeaking.value = false;
		} else {
			isUserSpeaking.value = false;
			isAgentSpeaking.value = true;
		}
	});

	// Reset speaking states after a delay
	setTimeout(() => {
		isUserSpeaking.value = false;
		isAgentSpeaking.value = false;
	}, 2000);

	// Continue conversation after a delay
	if (currentMockIndex.value < mockMessages.value.length - 1) {
		setTimeout(handleMockConversation, 300);
	}
}

export function Header() {
	useSignals();

	const toggleMockMode = () => {
		if (!isMockMode.value) {
			isMockMode.value = true;
			transcript.value = [];
			currentMockIndex.value = -1;
			handleMockConversation();
		} else {
			isMockMode.value = false;
			currentMockIndex.value = -1;
			transcript.value = [];
			isUserSpeaking.value = false;
			isAgentSpeaking.value = false;
		}
	};

	return (
		<div className="flex justify-between items-center p-2 bg-gray-800/50 backdrop-blur-sm border-b border-gray-700/50">
			<div className="flex gap-2 items-center">
				<button
					onClick={resetTimeline}
					className={cn(buttonStyles, "text-red-200/70 hover:text-red-200")}
				>
					Reset
				</button>
				<button
					onClick={togglePlayback}
					className={cn(buttonStyles, "text-blue-200/70 hover:text-blue-200")}
				>
					{isPlaying.value ? "Pause" : "Play"}
				</button>
				<div className="text-sm text-gray-400 font-mono tabular-nums">
					{formatTime(elapsedTime.value)}s
				</div>
				<button
					onClick={toggleMockMode}
					className={cn(
						buttonStyles,
						isMockMode.value
							? "text-purple-200 bg-purple-500/20 hover:bg-purple-500/30"
							: "text-purple-200/70 hover:text-purple-200",
					)}
				>
					{isMockMode.value ? "Stop Mock" : "Start Mock"}
				</button>
			</div>

			<button
				onClick={() => (isDebugOpen.value = !isDebugOpen.value)}
				className={cn(buttonStyles, "text-yellow-200/70 hover:text-yellow-200")}
			>
				{isDebugOpen.value ? "Hide" : "Show"} Debug (⌥D)
			</button>
		</div>
	);
}
