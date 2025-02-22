import { serve } from "bun";

const SHAPES_FILE = "shapes.json";

const server = serve({
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
				try {
					const { shapes, timelinePosition } = await req.json();
					// Sort shapes by x position
					const sortedShapes = shapes.sort((a, b) => a.x - b.x);
					const output = {
						shapes: sortedShapes,
						timelinePosition,
					};
					await Bun.write(SHAPES_FILE, JSON.stringify(output, null, 2));
					return Response.json({ success: true });
				} catch (error) {
					return new Response("Error writing shapes", { status: 500 });
				}
			},
		},
		"/api/signed-url": {
			async GET(req) {
				const agentId = process.env.AGENT_ID;
				const apiKey = process.env.XI_API_KEY;

				if (!agentId || !apiKey) {
					return new Response("Missing env for AGENT_ID or XI_API_KEY", {
						status: 500,
					});
				}

				try {
					const response = await fetch(
						`https://api.elevenlabs.io/v1/convai/conversation/get_signed_url?agent_id=${agentId}`,
						{
							method: "GET",
							headers: {
								"xi-api-key": apiKey,
							},
						},
					);

					if (!response.ok) {
						throw new Error("Failed to get signed URL");
					}

					const data = await response.json();
					return Response.json({ signedUrl: data.signed_url });
				} catch (error) {
					console.error("Error:", error);
					return new Response("Failed to get signed URL", { status: 500 });
				}
			},
		},
	},

	development: process.env.NODE_ENV !== "production",
});

console.log(`🚀 Server running at ${server.url}`);
