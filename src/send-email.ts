import { readFileSync, existsSync } from "fs";
import { createTransport } from "nodemailer";

export interface EmailConfig {
  smtp: {
    host: string;
    port: number;
    user: string;
    pass: string;
  };
  from: string;
  to: string[];
  subject: string;
}

export function loadEmailConfig(): EmailConfig | null {
  const configPath = "config/email.json";
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, "utf-8")) as EmailConfig;
  } catch {
    return null;
  }
}

export async function sendNewsletter(
  config: EmailConfig,
  htmlPath: string,
  newsletterDate: string
): Promise<void> {
  const html = readFileSync(htmlPath, "utf-8");

  const titleMatch = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  const title = titleMatch
    ? titleMatch[1].replace(/<[^>]*>/g, "")
    : "Newsletter";

  const subject = config.subject
    .replace(/\{\{date\}\}/g, newsletterDate)
    .replace(/\{\{title\}\}/g, title);

  const transport = createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: {
      user: config.smtp.user,
      pass: config.smtp.pass,
    },
  });

  await transport.sendMail({
    from: config.from,
    to: config.to.join(", "),
    subject,
    html,
  });
}
