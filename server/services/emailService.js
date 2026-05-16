import nodemailer from "nodemailer";
import {
  APP_BASE_URL,
  PASSWORD_RESET_TTL_MINUTES,
  SMTP_FROM,
  SMTP_HOST,
  SMTP_PASS,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
} from "../config/env.js";
import { HttpError } from "../lib/errors.js";

let cachedTransporter = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;
  if (!SMTP_HOST || !SMTP_FROM) {
    throw new HttpError(
      503,
      "Password reset email service is not configured yet.",
      "EMAIL_NOT_CONFIGURED",
    );
  }

  cachedTransporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: SMTP_USER && SMTP_PASS ? { user: SMTP_USER, pass: SMTP_PASS } : undefined,
  });

  return cachedTransporter;
}

export async function sendPasswordResetEmail({ email, firstName, resetToken }) {
  const transporter = getTransporter();
  const resetUrl = `${APP_BASE_URL.replace(/\/$/, "")}/reset-password?token=${encodeURIComponent(resetToken)}`;
  const displayName = firstName?.trim() || "Citizen";

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "Nexis password reset",
    text: [
      `Hello ${displayName},`,
      "",
      "A password reset was requested for your Nexis account.",
      `Reset your password here: ${resetUrl}`,
      "",
      `This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.`,
      "If you did not request this, you can safely ignore this email.",
    ].join("\n"),
    html: `
      <div style="font-family:Arial,sans-serif;line-height:1.5;color:#1a1a1a">
        <p>Hello ${displayName},</p>
        <p>A password reset was requested for your Nexis account.</p>
        <p><a href="${resetUrl}">Reset your password</a></p>
        <p>This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.</p>
        <p>If you did not request this, you can safely ignore this email.</p>
      </div>
    `,
  });
}
