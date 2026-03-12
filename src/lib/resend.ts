import { Resend } from "resend";

// Use a placeholder key so the constructor doesn't throw at build time;
// the sendDocumentEmail function guards against missing RESEND_API_KEY at runtime.
export const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");

// From address: use a verified domain in production, fallback to Resend's test sender
export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://accountant-ai-woad.vercel.app";
