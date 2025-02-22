import { serve } from "bun";
import type { TLShape } from "tldraw";

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
					const shapes = await req.json();
					await Bun.write(SHAPES_FILE, JSON.stringify(shapes, null, 2));
					return Response.json({ success: true });
				} catch (error) {
					return new Response("Error writing shapes", { status: 500 });
				}
			},
		},
	},

	development: process.env.NODE_ENV !== "production",
});

console.log(`🚀 Server running at ${server.url}`);
