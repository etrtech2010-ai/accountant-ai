import { Resend } from "resend";

export const resend = new Resend(process.env.RESEND_API_KEY);

// From address: use a verified domain in production, fallback to Resend's test sender
export const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev";

export const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL || "https://accountant-ai-woad.vercel.app";
