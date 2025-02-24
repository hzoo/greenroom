import { SpeechControl } from "@/lib/speech/SpeechControl";
import { chatbot, transcript } from "@/store/signals";
import { debugLog } from "@/lib/debug";

// Singleton instance
let instance: SpeechControl | null = null;

// Function to get or create the speech control instance
function getSpeechControl(): SpeechControl {
	if (!instance) {
		instance = new SpeechControl(
			{
				elevenlabsApiKey: import.meta.env.VITE_ELEVENLABS_API_KEY,
			},
			{
				onTranscriptUpdate: async (
					transcriptText: string,
					isFinal: boolean,
				) => {
					// debugLog("Transcript update:", { transcriptText, isFinal }, "speech");
					if (isFinal && chatbot.value) {
						debugLog(
							"Processing final transcript with chatbot",
							null,
							"speech",
						);
						const response = await chatbot.value.handleVoiceTranscript(
							transcriptText,
							"user",
						);
						if (response) {
							debugLog("Got chatbot response:", response, "speech");
							// Only add AI response since user message was already added
							transcript.value = transcript.value.concat([
								{ message: response.response.content, source: "ai" },
							]);
							// Speak response
							await instance?.speak(response.response.content);
						}
					}
				},
			},
		);

		// Handle hot module replacement
		if (import.meta.hot) {
			import.meta.hot.dispose(() => {
				// Cleanup the instance when the module is disposed
				instance?.stop();
				instance = null;
			});
		}
	}
	return instance;
}

// Export the singleton instance getter
export const speechControl = getSpeechControl();
