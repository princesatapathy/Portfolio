// Cloudflare Pages Function: answers POST /api/contact.
// Secrets come from Cloudflare (Pages project -> Settings -> Variables and Secrets), see .env.example.
import { handleContactRequest } from "../../src/server/contactHandler";
import type { ContactEnvironment } from "../../src/server/contactHandler";

type FunctionContext = { request: Request; env: ContactEnvironment };

export const onRequestPost = ({ request, env }: FunctionContext) => handleContactRequest(request, env);

// any other method (GET, PUT, ...) on this route
export const onRequest = () => Response.json({ error: "Method not allowed." }, { status: 405, headers: { Allow: "POST" } });
