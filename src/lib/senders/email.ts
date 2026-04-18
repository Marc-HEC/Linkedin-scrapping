// Envoi email via SMTP (nodemailer). Creds déchiffrés depuis user_integrations.

export type SmtpCreds = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
  from_email?: string;
  from_name?: string;
};

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export async function sendViaSmtp(creds: SmtpCreds, payload: EmailPayload): Promise<string> {
  const nodemailer = await import("nodemailer");
  const transporter = nodemailer.createTransport({
    host: creds.host,
    port: creds.port,
    secure: creds.secure,
    auth: { user: creds.user, pass: creds.password },
    pool: true,
    maxConnections: 3,
  });
  const from = creds.from_name
    ? `"${creds.from_name}" <${creds.from_email ?? creds.user}>`
    : (creds.from_email ?? creds.user);
  const info = await transporter.sendMail({
    from,
    to: payload.to,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
  });
  return info.messageId;
}
