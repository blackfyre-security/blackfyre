import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";

export interface EmailChannelConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
}

/**
 * EmailChannel — sends email notifications via SMTP using nodemailer.
 *
 * Fails gracefully: logs the error but never throws, so a broken email
 * config cannot take down the caller.
 */
export class EmailChannel {
  private transporter: Transporter | null = null;
  private from: string;

  constructor(private config: EmailChannelConfig) {
    this.from = config.from;

    if (!config.host) {
      console.warn("[EmailChannel] SMTP_HOST not configured — email sending disabled.");
      return;
    }

    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.port === 465,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  async sendEmail(to: string, subject: string, htmlBody: string): Promise<void> {
    if (!this.transporter) {
      console.log(`[EmailChannel] Skipped (no SMTP config): to=${to} subject="${subject}"`);
      return;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        html: htmlBody,
      });
      console.log(`[EmailChannel] Sent email to=${to} subject="${subject}"`);
    } catch (err) {
      console.error(`[EmailChannel] Failed to send email to=${to}:`, err);
    }
  }
}
