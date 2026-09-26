import 'server-only';
import nodemailer, { type Transporter } from 'nodemailer';

// Outgoing email (login codes, password resets, welcome emails, payment alerts) via SMTP settings in .env.local.
// Gmail: SMTP_HOST=smtp.gmail.com, SMTP_PORT=587 (STARTTLS) or 465 (SSL), SMTP_USER=<gmail>, SMTP_PASS=<app password>.

export const mailConfigured = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: Transporter | null = null;

function getTransport() {
  if (transport) return transport;
  const port = Number(process.env.SMTP_PORT || 587);
  transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465, // 465 = SSL from the start; 587 = plain connection upgraded with STARTTLS
    requireTLS: port !== 465, // never send over an unencrypted connection
    auth: { user: process.env.SMTP_USER, pass: (process.env.SMTP_PASS || '').replace(/\s+/g, '') }, // Gmail app passwords are often copied with spaces
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  return transport;
}

/** Sends an email. Returns false (and prints it to the server log) when email isn't configured. */
export async function sendMail(to: string, subject: string, text: string, replyTo?: string, html?: string): Promise<boolean> {
  if (!mailConfigured()) {
    console.log(`\n[mail not configured] To: ${to}\nSubject: ${subject}\n${text}\n`);
    return false;
  }
  const fromName = process.env.MAIL_FROM_NAME || 'ReuseMe';
  await getTransport().sendMail({ from: `${fromName} <${process.env.SMTP_USER}>`, to, subject, text, html, replyTo });
  return true;
}

/** A one-time-code email: plain text plus a simple branded HTML version with the code shown large. */
export function sendCodeMail(to: string, code: string, purpose: 'login' | 'reset' | 'signup', minutes: number) {
  const what = { login: 'sign in to ReuseMe', reset: 'reset your ReuseMe password', signup: 'create your ReuseMe account' }[purpose];
  const subject = `${code} is your ReuseMe ${{ login: 'login', reset: 'password reset', signup: 'sign-up' }[purpose]} code`;
  const text = `Your code to ${what} is: ${code}

It expires in ${minutes} minutes. If you didn't ask for this, you can ignore this email.`;
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:460px;margin:0 auto;padding:28px 24px;color:#0e1220">
  <div style="font-size:22px;font-weight:800;letter-spacing:-0.5px"><span style="color:#2f6df0">Reuse</span><span style="color:#1b1b1d">Me</span></div>
  <p style="font-size:15px;line-height:1.6;margin:22px 0 8px">Use this code to ${what}:</p>
  <div style="font-size:34px;font-weight:800;letter-spacing:10px;padding:16px 0;text-align:center;background:#eef3ff;border-radius:12px;color:#1d4ed8">${code}</div>
  <p style="font-size:13px;line-height:1.6;color:#667085;margin:16px 0 0">It expires in ${minutes} minutes. If you didn't ask for this, you can safely ignore this email.</p>
</div>`;
  return sendMail(to, subject, text, undefined, html);
}

/** Checks the SMTP login without sending anything. */
export async function verifyMail(): Promise<true> {
  await getTransport().verify();
  return true;
}
