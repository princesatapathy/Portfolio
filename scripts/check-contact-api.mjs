// Behavior check for the contact function (functions/api/contact.ts, run by Cloudflare Pages)
// with a mocked network, so no real email is sent.   Run: npm run check:contact
import { buildSync } from "esbuild";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const temporaryDirectory = mkdtempSync(join(tmpdir(), "contact-check-"));
const bundledFile = join(temporaryDirectory, "contact.mjs");
buildSync({
  entryPoints: ["functions/api/contact.ts"],
  bundle: true,
  platform: "node",
  format: "esm",
  outfile: bundledFile,
  logLevel: "silent",
});
const { onRequestPost, onRequest } = await import(pathToFileURL(bundledFile).href);

const validBody = {
  name: "Ada Lovelace",
  email: "ada@example.com",
  message: "Hello, I would like to talk about a project.",
  recaptchaToken: "",
  website: "",
};

const networkCalls = [];
let recaptchaScore = 0.9;
globalThis.fetch = async (url, init) => {
  networkCalls.push({ url: String(url), init });
  if (String(url).includes("recaptcha")) {
    return Response.json({ success: true, score: recaptchaScore, action: "contact" });
  }
  return Response.json({ id: "email_test_123" });
};

// Cloudflare hands secrets to the function as `env`; each check builds its own
let env = {};
const send = (body) =>
  onRequestPost({
    request: new Request("http://localhost/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    env,
  });

const reset = (newEnv = {}) => {
  env = newEnv;
  networkCalls.length = 0;
};

// 1. missing API key fails loudly, nothing is sent
reset();
let response = await send(validBody);
assert.equal(response.status, 500);
assert.equal(networkCalls.length, 0);

// 2. invalid input is rejected before any network call
reset({ RESEND_API_KEY: "re_test" });
response = await send({ ...validBody, email: "not-an-email" });
assert.equal(response.status, 400);
assert.equal(networkCalls.length, 0);

// 3. honeypot filled: pretends success, sends nothing
reset({ RESEND_API_KEY: "re_test" });
response = await send({ ...validBody, website: "http://spam.example" });
assert.equal(response.status, 200);
assert.equal(networkCalls.length, 0);

// 4. valid message without reCAPTCHA configured: one Resend call with the right fields
reset({ RESEND_API_KEY: "re_test" });
response = await send({ ...validBody, name: "Ada\nBcc: evil@example.com" });
assert.equal(response.status, 200);
assert.equal(networkCalls.length, 1);
const resendPayload = JSON.parse(networkCalls[0].init.body);
assert.equal(networkCalls[0].url, "https://api.resend.com/emails");
assert.equal(resendPayload.from, "Portfolio Contact <onboarding@resend.dev>");
assert.deepEqual([resendPayload.to].flat(), ["princesatapathywork@gmail.com"]);
assert.equal(resendPayload.reply_to, "ada@example.com");
assert.ok(!resendPayload.subject.includes("\n"), "subject must be a single line");
assert.ok(resendPayload.text.includes("Hello, I would like to talk"));

// 5. env overrides for sender and recipient
reset({ RESEND_API_KEY: "re_test", RESEND_FROM_EMAIL: "Me <hello@mail.example.com>", CONTACT_TO_EMAIL: "inbox@example.com" });
response = await send(validBody);
assert.equal(response.status, 200);
const overridden = JSON.parse(networkCalls[0].init.body);
assert.equal(overridden.from, "Me <hello@mail.example.com>");
assert.deepEqual([overridden.to].flat(), ["inbox@example.com"]);

// 6. reCAPTCHA configured: token required, low score rejected, good score accepted
reset({ RESEND_API_KEY: "re_test", RECAPTCHA_SECRET_KEY: "secret" });
response = await send(validBody);
assert.equal(response.status, 400);
recaptchaScore = 0.1;
response = await send({ ...validBody, recaptchaToken: "tok" });
assert.equal(response.status, 403);
assert.ok(!networkCalls.some((call) => call.url.includes("resend.com")), "no email on a failed captcha");
recaptchaScore = 0.9;
networkCalls.length = 0;
response = await send({ ...validBody, recaptchaToken: "tok" });
assert.equal(response.status, 200);
assert.ok(networkCalls.some((call) => call.url.includes("resend.com")));

// 7. only POST is allowed on this route
reset({ RESEND_API_KEY: "re_test" });
const getResponse = await onRequest({ request: new Request("http://localhost/api/contact", { method: "GET" }), env });
assert.equal(getResponse.status, 405);

rmSync(temporaryDirectory, { recursive: true, force: true });
console.log("contact function: all 7 checks passed");
