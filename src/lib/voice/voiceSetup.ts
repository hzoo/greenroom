import { effect } from "@preact/signals-react";
import { SpeechControl } from "@/lib/speech/SpeechControl";
import { isConnected, isPaused, chatbot, transcript } from "@/store/signals";
import { debugLog } from "@/lib/debug";

// Create a signal for the speech control instance
export const speechControl = new SpeechControl(
	{
		elevenlabsApiKey: import.meta.env.VITE_ELEVENLABS_API_KEY,
	},
	{
		onTranscriptUpdate: async (transcriptText: string, isFinal: boolean) => {
			debugLog("Transcript update:", { transcriptText, isFinal }, "speech");
			if (isFinal && chatbot.value) {
				debugLog("Processing final transcript with chatbot", null, "speech");
				const response = await chatbot.value.handleVoiceTranscript(
					transcriptText,
					"user",
				);
				if (response) {
					debugLog("Got chatbot response:", response, "speech");
					// Update transcript
					transcript.value = transcript.value.concat([
						{ message: transcriptText, source: "user" },
						{ message: response.response.content, source: "ai" },
					]);
					// Speak response
					await speechControl.speak(response.response.content);
				}
			}
		},
	},
);

// Initialize speech control
export async function initializeSpeechControl() {
	// Set up cleanup on window unload
	window.addEventListener("unload", () => {
		speechControl.stop();
	});

	// Effect for play state only
	effect(() => {
		if (!isConnected.peek()) return;

		if (!isPaused.value) {
			debugLog("Resuming speech control...", null, "speech");
			speechControl.resume();
		} else {
			debugLog("Pausing speech control...", null, "speech");
			speechControl.pause();
		}
	});
}
