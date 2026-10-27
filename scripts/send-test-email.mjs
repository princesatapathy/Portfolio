// Sends ONE real test message through worker/index.ts (the same code Cloudflare runs), using the
// RESEND_API_KEY from a local .env (or .dev.vars) file. Prints only the HTTP status and the API's answer,
// never the key.
//   npm run send:test-email
import { buildSync } from "esbuild";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

// the settings the function would receive from Cloudflare as `env`:
// KEY=value lines from .env / .dev.vars, with already-set environment variables winning
const env = {};
for (const file of [".env", ".dev.vars"]) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*"?([^"#]*?)"?\s*(?:#.*)?$/);
    if (match) env[match[1]] = process.env[match[1]] ?? match[2];
  }
}
env.RESEND_API_KEY ??= process.env.RESEND_API_KEY;

if (!env.RESEND_API_KEY) {
  console.error("No RESEND_API_KEY found. Create a file named .env in this folder containing:");
  console.error('  RESEND_API_KEY="re_..."');
  console.error("(.env and .dev.vars are git-ignored, so they are never committed.) Then run this again.");
  process.exit(1);
}

const recipient = env.CONTACT_TO_EMAIL || "princesatapathywork@gmail.com";
console.log(`Sending one test message to ${recipient} via Resend...`);

const temporaryDirectory = mkdtempSync(join(tmpdir(), "contact-live-"));
const bundledFile = join(temporaryDirectory, "contact.mjs");
buildSync({ entryPoints: ["worker/index.ts"], bundle: true, platform: "node", format: "esm", outfile: bundledFile, logLevel: "silent" });
const { default: worker } = await import(pathToFileURL(bundledFile).href);

const response = await worker.fetch(
  new Request("http://localhost/api/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Portfolio contact form test",
      email: recipient,
      message: `Test message sent from the portfolio contact form at ${new Date().toISOString()}.`,
      recaptchaToken: "",
      website: "",
    }),
  }),
  env,
);
rmSync(temporaryDirectory, { recursive: true, force: true });

const body = await response.json();
console.log("status:", response.status, JSON.stringify(body));
if (response.status === 200) console.log(`Success. Check the inbox of ${recipient} (and its spam folder).`);
process.exit(response.status === 200 ? 0 : 1);
