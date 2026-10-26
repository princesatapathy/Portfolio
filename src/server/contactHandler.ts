import { Resend } from "resend";

import {
  CONTACT_EMAIL_FALLBACK,
  CONTACT_RECAPTCHA_ACTION,
  validateContactForm,
} from "../lib/contact";

// Sender used when RESEND_FROM_EMAIL is not set. Resend only allows this address
// to deliver to the Resend account owner's own email until a domain is verified.
const DEFAULT_FROM_EMAIL = "Portfolio Contact <onboarding@resend.dev>";

// the secrets and settings this handler reads (Cloudflare passes them in as `env`)
export type ContactEnvironment = {
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  CONTACT_TO_EMAIL?: string;
  RECAPTCHA_SECRET_KEY?: string;
  RECAPTCHA_MIN_SCORE?: string;
};

type RecaptchaVerifyResponse = {
  success: boolean;
  score?: number;
  action?: string;
  "error-codes"?: string[];
};

type ContactRequestBody = {
  name?: unknown;
  email?: unknown;
  message?: unknown;
  recaptchaToken?: unknown;
  // honeypot: hidden field that real visitors never fill in
  website?: unknown;
};

const json = (body: unknown, status = 200) =>
  Response.json(body, { status });

// Cloudflare sets cf-connecting-ip to the real visitor address
const getClientIp = (request: Request): string | undefined =>
  request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? undefined;

const verifyRecaptcha = async (
  token: string,
  secret: string,
  minScoreSetting: string | undefined,
  remoteIp?: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> => {
  const body = new URLSearchParams({
    secret,
    response: token,
  });

  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  let data: RecaptchaVerifyResponse;
  try {
    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body,
      },
    );
    data = (await response.json()) as RecaptchaVerifyResponse;
  } catch (error) {
    console.error("reCAPTCHA verification request failed:", error);
    return {
      ok: false,
      status: 502,
      error: "Unable to verify reCAPTCHA. Please try again.",
    };
  }

  const minScore = Number(minScoreSetting ?? "0.5");
  const score = data.score ?? 0;

  if (
    !data.success ||
    data.action !== CONTACT_RECAPTCHA_ACTION ||
    Number.isNaN(minScore) ||
    score < minScore
  ) {
    console.error("reCAPTCHA verification failed:", {
      success: data.success,
      action: data.action,
      errorCodes: data["error-codes"],
    });
    return {
      ok: false,
      status: 403,
      error: "reCAPTCHA verification failed. Please try again.",
    };
  }

  return { ok: true };
};

// keep user text out of email headers
const toSingleLine = (value: string) => value.replace(/[\r\n]+/g, " ").trim();

export async function handleContactRequest(request: Request, env: ContactEnvironment) {
  let payload: ContactRequestBody;
  try {
    payload = (await request.json()) as ContactRequestBody;
  } catch {
    return json({ error: "Invalid request." }, 400);
  }

  const name = typeof payload.name === "string" ? payload.name : "";
  const email = typeof payload.email === "string" ? payload.email : "";
  const message = typeof payload.message === "string" ? payload.message : "";
  const recaptchaToken =
    typeof payload.recaptchaToken === "string" ? payload.recaptchaToken : "";

  // bots fill the hidden field: answer "ok" so they do not retry, but send nothing
  if (typeof payload.website === "string" && payload.website.trim() !== "") {
    return json({ ok: true });
  }

  const validationError = validateContactForm({ name, email, message });
  if (validationError) {
    return json({ error: validationError }, 400);
  }

  // reCAPTCHA is enforced only when its secret key is configured
  const recaptchaSecret = env.RECAPTCHA_SECRET_KEY;
  if (recaptchaSecret) {
    if (!recaptchaToken) {
      return json({ error: "reCAPTCHA token is missing." }, 400);
    }

    const recaptchaResult = await verifyRecaptcha(
      recaptchaToken,
      recaptchaSecret,
      env.RECAPTCHA_MIN_SCORE,
      getClientIp(request),
    );
    if (!recaptchaResult.ok) {
      return json({ error: recaptchaResult.error }, recaptchaResult.status);
    }
  }

  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("RESEND_API_KEY is not set.");
    return json({ error: "Server configuration error." }, 500);
  }

  const from = env.RESEND_FROM_EMAIL || DEFAULT_FROM_EMAIL;
  const adminEmail = env.CONTACT_TO_EMAIL || CONTACT_EMAIL_FALLBACK;

  const trimmedName = name.trim();
  const trimmedEmail = email.trim();
  const trimmedMessage = message.trim();

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from,
      to: adminEmail,
      replyTo: trimmedEmail,
      subject: `Portfolio message from ${toSingleLine(trimmedName)}`,
      text: `Name: ${trimmedName}\nEmail: ${trimmedEmail}\n\n${trimmedMessage}`,
    });

    if (error) {
      console.error("Resend send failed:", error);
      return json({ error: "Failed to send message. Please try again." }, 502);
    }
  } catch (error) {
    console.error("Unexpected error while sending email:", error);
    return json({ error: "Failed to send message. Please try again." }, 500);
  }

  return json({ ok: true });
}
