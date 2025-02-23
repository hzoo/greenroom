import type { ServerWebSocket } from "bun";
import type { WebSocket as WSType } from "ws";
import WebSocket from "ws";

interface TwilioMessage {
	event: "start" | "media" | "stop";
	streamSid?: string;
	media?: {
		payload: string;
	};
}

interface ElevenLabsMessage {
	text?: string;
	audio?: string;
	isFinal?: boolean;
}

// Handle WebSocket connection for media streaming
export function handleMediaStream(ws: ServerWebSocket<unknown>) {
	let elevenLabsWs: WSType | null = null;

	ws.subscribe("media-stream");

	ws.data = async (data: string | Buffer) => {
		try {
			const message = JSON.parse(data.toString()) as TwilioMessage;

			switch (message.event) {
				case "start":
					console.log("Starting media stream:", message.streamSid);
					elevenLabsWs = new WebSocket(
						"wss://api.elevenlabs.io/v1/text-to-speech/stream",
					);

					elevenLabsWs.on("message", async (data: WebSocket.Data) => {
						const elevenlabsData = JSON.parse(
							data.toString(),
						) as ElevenLabsMessage;

						if (elevenlabsData.audio) {
							ws.send(
								JSON.stringify({
									event: "media",
									streamSid: message.streamSid,
									media: {
										payload: elevenlabsData.audio,
									},
								}),
							);
						}

						if (elevenlabsData.isFinal) {
							ws.send(
								JSON.stringify({
									event: "stop",
									streamSid: message.streamSid,
								}),
							);
							elevenLabsWs?.close();
							elevenLabsWs = null;
						}
					});

					elevenLabsWs.on("error", (error: Error) => {
						console.error("ElevenLabs WebSocket error:", error);
						ws.send(
							JSON.stringify({
								event: "stop",
								streamSid: message.streamSid,
								error: "ElevenLabs WebSocket error",
							}),
						);
						elevenLabsWs?.close();
						elevenLabsWs = null;
					});
					break;

				case "media":
					if (
						message.media?.payload &&
						elevenLabsWs?.readyState === WebSocket.OPEN
					) {
						elevenLabsWs.send(
							JSON.stringify({
								text: message.media.payload,
								voice_id: process.env.AGENT_ID,
								model_id: "eleven_monolingual_v1",
							}),
						);
					}
					break;

				case "stop":
					console.log("Stopping media stream:", message.streamSid);
					elevenLabsWs?.close();
					elevenLabsWs = null;
					break;
			}
		} catch (error) {
			console.error("Error handling WebSocket message:", error);
			ws.send(
				JSON.stringify({
					event: "error",
					error: "Failed to process message",
				}),
			);
		}
	};

	ws.unsubscribe = () => {
		console.log("Client WebSocket closed");
		elevenLabsWs?.close();
		elevenLabsWs = null;
	};
}

// Generate TwiML response for inbound calls
export function generateTwiML(
	host: string,
	options?: { prompt?: string; first_message?: string },
) {
	const streamUrl = `wss://${host}/api/media-stream`;
	const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="${streamUrl}">
            ${options?.prompt ? `<Parameter name="prompt" value="${options.prompt}"/>` : ""}
            ${options?.first_message ? `<Parameter name="first_message" value="${options.first_message}"/>` : ""}
        </Stream>
    </Connect>
</Response>`;
	return twiml;
}
