// Cloudflare Worker. Cloudflare serves the built site (dist/) as static assets by itself;
// only /api/* requests reach this code (see run_worker_first in wrangler.toml).
import { handleContactRequest } from "../src/server/contactHandler";
import type { ContactEnvironment } from "../src/server/contactHandler";

export default {
  async fetch(request: Request, env: ContactEnvironment): Promise<Response> {
    const { pathname } = new URL(request.url);

    if (pathname === "/api/contact") {
      if (request.method !== "POST") {
        return Response.json({ error: "Method not allowed." }, { status: 405, headers: { Allow: "POST" } });
      }
      return handleContactRequest(request, env);
    }

    return Response.json({ error: "Not found." }, { status: 404 });
  },
};
