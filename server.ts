import { serve } from "bun";
import { generateTwiML, handleMediaStream } from "./src/lib/twilio";

const SHAPES_FILE = "shapes.json";
const ELEVENLABS_API_KEY = process.env.XI_API_KEY;
const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Validate required environment variables
if (!ELEVENLABS_API_KEY) {
	console.error("XI_API_KEY is not set");
	process.exit(1);
}

const server = serve({
	port: process.env.PORT || 3000,

	// Handle WebSocket connections and unmatched routes
	async fetch(req) {
		const url = new URL(req.url);

		// Handle WebSocket upgrade for media streaming
		if (
			url.pathname === "/api/media-stream" &&
			req.headers.get("upgrade")?.toLowerCase() === "websocket"
		) {
			const upgraded = server.upgrade(req);
			if (!upgraded) {
				return new Response("WebSocket upgrade failed", { status: 400 });
			}
			handleMediaStream(upgraded.socket);
			return upgraded.response;
		}

		return new Response("Not Found", { status: 404 });
	},

	// Route handlers
	routes: {
		"/api/shapes": {
			async GET(req) {
				try {
					const file = Bun.file(SHAPES_FILE);
					if (await file.exists()) {
						const shapes = await file.json();
						return Response.json(shapes);
					}
					return Response.json([]);
				} catch (error) {
					return new Response("Error reading shapes", { status: 500 });
				}
			},
			async PUT(req) {
				const shapes = await req.json();
				try {
					// Sort shapes by x position
					const sortedShapes = shapes.sort((a, b) => a.x - b.x);
					await Bun.write(SHAPES_FILE, JSON.stringify(sortedShapes, null, 2));
					return Response.json({ success: true });
				} catch (error) {
					console.error("Error writing shapes", error, shapes);
					return new Response("Error writing shapes", { status: 500 });
				}
			},
		},

		"/api/elevenlabs/agents": {
			// Create a new agent
			async POST(req) {
				try {
					const { name, prompt } = await req.json();

					const response = await fetch(
						"https://api.elevenlabs.io/v1/convai/agents/create",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								"xi-api-key": ELEVENLABS_API_KEY!,
							},
							body: JSON.stringify({
								name,
								conversation_config: {
									prompt,
									initial_message: "Hello! I'm your AI assistant.",
									model: {
										provider: "elevenlabs",
										model_id: "eleven_monolingual_v1",
									},
								},
							}),
						},
					);

					if (!response.ok) {
						throw new Error(`Failed to create agent: ${response.statusText}`);
					}

					const data = await response.json();
					return Response.json({ agentId: data.agent_id });
				} catch (error) {
					console.error("Error creating agent:", error);
					return new Response("Failed to create agent", { status: 500 });
				}
			},
		},

		"/api/elevenlabs/signed-url": {
			// Get signed URL for a specific agent
			async GET(req) {
				try {
					const url = new URL(req.url);
					const agentId = url.searchParams.get("agentId");

					if (!agentId) {
						return new Response("Agent ID is required", { status: 400 });
					}

					const response = await fetch(
						`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
						{
							method: "GET",
							headers: {
								"xi-api-key": ELEVENLABS_API_KEY!,
							},
						},
					);

					if (!response.ok) {
						throw new Error(`Failed to get signed URL: ${response.statusText}`);
					}

					const data = await response.json();
					return Response.json({ signedUrl: data.signed_url });
				} catch (error) {
					console.error("Error getting signed URL:", error);
					return new Response("Failed to get signed URL", { status: 500 });
				}
			},
		},

		"/api/twilio/inbound-call": {
			POST(req) {
				const twiml = generateTwiML(req.headers.get("host") || "");
				return new Response(twiml, {
					headers: { "Content-Type": "text/xml" },
				});
			},
		},

		"/api/twilio/outbound-call": {
			async POST(req) {
				if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
					return new Response("Missing Twilio configuration", { status: 500 });
				}

				try {
					const { number, prompt, first_message } = await req.json();
					if (!number) {
						return new Response("Phone number is required", { status: 400 });
					}

					const twiml = generateTwiML(req.headers.get("host") || "", {
						prompt,
						first_message,
					});

					// For now, just return success without actually making the call
					return Response.json({
						success: true,
						callSid: `test-${Date.now()}`,
						twiml,
					});
				} catch (error) {
					console.error("Error initiating outbound call:", error);
					return new Response("Failed to initiate call", { status: 500 });
				}
			},
		},
	},

	development: process.env.NODE_ENV !== "production",
});

console.log(`🚀 Server running at ${server.url}`);
