/**
 * Transactional email through Resend. Optional: without RESEND_API_KEY every
 * call is a no-op, so the app works exactly as before.
 * Free tier covers 3,000 emails a month.
 */

const ENDPOINT = "https://api.resend.com/emails";

export function mailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && process.env.MAIL_FROM);
}

export async function sendMail(params: {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}): Promise<boolean> {
  if (!mailConfigured()) return false;

  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.MAIL_FROM,
        to: [params.to],
        subject: params.subject,
        html: params.html,
        ...(params.replyTo ? { reply_to: params.replyTo } : {}),
      }),
    });
    if (!res.ok) console.error("[mail] resend rejected:", res.status, await res.text());
    return res.ok;
  } catch (e) {
    console.error("[mail] send failed", e);
    return false;
  }
}

/** Notification an agent gets the moment a visitor leaves their number. */
export function leadEmail(params: {
  agentName: string;
  propertyTitle: string;
  propertyUrl: string;
  name: string;
  phone: string;
  email?: string | null;
  message?: string | null;
}) {
  const row = (k: string, v: string) =>
    `<tr><td style="padding:6px 0;color:#737373;font-size:14px;width:110px;">${k}</td>
         <td style="padding:6px 0;color:#0a0a0a;font-size:14px;font-weight:500;">${v}</td></tr>`;

  return `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f5f5f5;padding:32px 12px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:480px;background:#fff;border-radius:20px;border:1px solid #e5e5e5;">
      <tr><td style="padding:32px 32px 0;">
        <h1 style="margin:0 0 6px;font-size:20px;color:#0a0a0a;font-weight:600;letter-spacing:-0.3px;">Шинэ хүсэлт ирлээ</h1>
        <p style="margin:0 0 20px;font-size:14px;color:#737373;">${params.propertyTitle}</p>
        <table cellpadding="0" cellspacing="0" border="0" width="100%">
          ${row("Нэр", params.name)}
          ${row("Утас", `<a href="tel:${params.phone}" style="color:#0a0a0a;">${params.phone}</a>`)}
          ${params.email ? row("И-мэйл", params.email) : ""}
          ${params.message ? row("Мессеж", params.message) : ""}
        </table>
      </td></tr>
      <tr><td align="center" style="padding:24px 32px 8px;">
        <table cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="background:#0a0a0a;border-radius:999px;">
            <a href="tel:${params.phone}" style="display:inline-block;padding:13px 30px;color:#fff;font-size:15px;font-weight:500;text-decoration:none;">Залгах</a>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="padding:16px 32px 32px;">
        <div style="height:1px;background:#e5e5e5;margin-bottom:16px;"></div>
        <p style="margin:0;font-size:13px;color:#a3a3a3;">
          <a href="${params.propertyUrl}" style="color:#737373;">Зараа харах</a> · TourHome AI
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>`;
}
