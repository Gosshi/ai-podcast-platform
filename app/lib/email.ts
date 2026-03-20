import { Resend } from "resend";
import { BRAND_NAME } from "@/src/lib/brand";

const getResendClient = (): Resend | null => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) return null;
  return new Resend(apiKey);
};

const EMAIL_FROM =
  process.env.EMAIL_FROM?.trim() || `${BRAND_NAME} <noreply@signal-move.com>`;

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text?: string;
};

type SendEmailResult = {
  ok: boolean;
  error?: string;
};

export const sendEmail = async (params: SendEmailParams): Promise<SendEmailResult> => {
  const resend = getResendClient();
  if (!resend) {
    return { ok: false, error: "email_not_configured" };
  }

  try {
    const { error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "email_send_failed"
    };
  }
};
