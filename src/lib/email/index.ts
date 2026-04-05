import { Resend } from "resend";
import { config } from "@/config/env";

if (!config.resendApiKey) {
  console.warn("[email] RESEND_API_KEY not set — email sending is DISABLED");
}

const resend = config.resendApiKey ? new Resend(config.resendApiKey) : null;

export type SendEmailOptions = {
  to: string;
  subject: string;
  html: string;
};

/**
 * Send a transactional email via Resend.
 * No-ops gracefully when RESEND_API_KEY is not configured.
 * Errors are logged but never rethrown — email failures must not break API requests.
 */
export async function sendEmail(options: SendEmailOptions): Promise<void> {
  if (!resend) {
    console.warn(`[email] Skipped send to ${options.to} — no Resend client`);
    return;
  }
  try {
    const { error } = await resend.emails.send({
      from: config.emailFrom,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });
    if (error) {
      console.error(`[email] Resend error for ${options.to}:`, error);
    }
  } catch (err) {
    console.error(`[email] Unexpected error sending to ${options.to}:`, err);
  }
}
