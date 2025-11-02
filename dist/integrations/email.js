import nodemailer from 'nodemailer';
import { env } from '../config/env.js';
export async function sendEmail(to, subject, text, html) {
    if (!env.SMTP_HOST || !env.SMTP_PORT) {
        return {};
    }
    const port = Number(env.SMTP_PORT);
    // secure: true для портов 465 (SSL), false для других портов
    const secure = port === 465;
    const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port,
        secure,
        auth: env.SMTP_USER || env.SMTP_PASS ? { user: env.SMTP_USER, pass: env.SMTP_PASS } : undefined,
    });
    const info = await transporter.sendMail({
        from: env.SMTP_FROM || 'support@example.com',
        to,
        subject,
        text,
        html,
    });
    return { messageId: info.messageId };
}
