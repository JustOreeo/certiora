import type { Job } from "bullmq";
import { sendEmail, type SendEmailOptions } from "@/lib/email";

export async function handleSendEmail(job: Job<SendEmailOptions>): Promise<void> {
  await sendEmail(job.data);
}
