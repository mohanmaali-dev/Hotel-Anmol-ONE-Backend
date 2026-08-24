import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

export const sendEmail = async ({ to, subject, text, html }) => {
  if (!env.emailEnabled) return;

  if (!env.emailHost || !env.emailUser || !env.emailPassword || !env.emailFrom) {
    throw new Error('Email settings are missing');
  }

  const nodemailer = await import('nodemailer');
  const transporter = nodemailer.default.createTransport({
    host: env.emailHost,
    port: env.emailPort,
    secure: env.emailSecure,
    auth: {
      user: env.emailUser,
      pass: env.emailPassword,
    },
  });

  const info = await transporter.sendMail({
    from: env.emailFrom,
    to,
    subject,
    text,
    html,
  });

  logger.info(`Email accepted for: ${info.accepted.join(', ')}`);

  if (info.rejected.length) {
    logger.error(`Email rejected for: ${info.rejected.join(', ')}`);
  }

  return info;
};
