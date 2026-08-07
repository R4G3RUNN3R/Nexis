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
      "Email service is not configured yet.",
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

// Shared shell for every account-action email (password reset, email change
// confirm, ...) so they all carry the same Nexis look. Table-based layout
// with inline styles only - no <style> block, no flexbox/grid/gradients -
// so it renders consistently in Outlook desktop's Word engine as well as
// Gmail/Apple Mail, not just modern browsers. Colors are the exact values
// from src/styles/nexis-theme.css's :root palette, not approximations, so
// this actually matches the rest of the site. The wordmark/divider are real
// hosted PNGs (public/email/*, built into the frontend bundle) rather than
// inline SVG or base64 data URIs - Outlook desktop's Word rendering engine
// doesn't reliably support either of those in emails.
function renderAccountEmailHtml({ preheader, heading, greetingName, bodyLines, ctaLabel, ctaUrl, footerNote }) {
  const emailBase = APP_BASE_URL.replace(/\/$/, "");
  const paragraphs = bodyLines
    .map((line) => `<p style="margin:0 0 16px;color:#c9d3da;font-size:14px;line-height:1.6;">${line}</p>`)
    .join("");

  return `
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#05090c;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#12191f;border:1px solid #2a3640;border-radius:10px;">
        <tr>
          <td style="padding:0;border-bottom:1px solid #2a3640;">
            <img src="${emailBase}/email/nexis-email-wordmark.png" width="520" height="146" alt="NEXIS" style="display:block;width:100%;max-width:520px;height:auto;border-radius:10px 10px 0 0;" />
          </td>
        </tr>
        <tr>
          <td style="padding:28px 32px 8px;">
            <h1 style="margin:0 0 16px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:18px;color:#f5f8fb;">${heading}</h1>
            <p style="margin:0 0 16px;color:#c9d3da;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:14px;line-height:1.6;">Hello ${greetingName},</p>
            <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">${paragraphs}</div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;">
              <tr>
                <td style="border-radius:6px;background-color:#9aaf67;">
                  <a href="${ctaUrl}" style="display:inline-block;padding:12px 24px;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:14px;font-weight:bold;color:#12191f;text-decoration:none;border-radius:6px;">${ctaLabel}</a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 20px;color:#7f8c98;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:12px;line-height:1.6;word-break:break-all;">Or copy this link: <a href="${ctaUrl}" style="color:#9aaf67;">${ctaUrl}</a></p>
            <img src="${emailBase}/email/nexis-email-divider.png" width="220" height="14" alt="" style="display:block;margin:0 0 20px;" />
            <p style="margin:0;color:#7f8c98;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;font-size:12px;line-height:1.6;">${footerNote}</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
  `;
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
    html: renderAccountEmailHtml({
      preheader: "Reset your Nexis password - this link expires soon.",
      heading: "Password reset requested",
      greetingName: displayName,
      bodyLines: [
        "A password reset was requested for your Nexis account.",
        `This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.`,
      ],
      ctaLabel: "Reset your password",
      ctaUrl: resetUrl,
      footerNote: "If you did not request this, you can safely ignore this email - your password will not change.",
    }),
  });
}

export async function sendEmailChangeConfirmation({ email, firstName, confirmToken }) {
  const transporter = getTransporter();
  const confirmUrl = `${APP_BASE_URL.replace(/\/$/, "")}/confirm-email-change?token=${encodeURIComponent(confirmToken)}`;
  const displayName = firstName?.trim() || "Citizen";

  await transporter.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: "Confirm your new Nexis email address",
    text: [
      `Hello ${displayName},`,
      "",
      "A request was made to change the email address on your Nexis account to this one.",
      `Confirm the change here: ${confirmUrl}`,
      "",
      `This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.`,
      "If you did not request this, you can safely ignore this email - your account email will not change.",
    ].join("\n"),
    html: renderAccountEmailHtml({
      preheader: "Confirm the new email address on your Nexis account.",
      heading: "Confirm your new email address",
      greetingName: displayName,
      bodyLines: [
        "A request was made to change the email address on your Nexis account to this one.",
        `This link expires in ${PASSWORD_RESET_TTL_MINUTES} minutes.`,
      ],
      ctaLabel: "Confirm the change",
      ctaUrl: confirmUrl,
      footerNote: "If you did not request this, you can safely ignore this email - your account email will not change.",
    }),
  });
}
