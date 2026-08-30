import nodemailer from 'nodemailer';
import { env } from '../../config/env.js';

export interface SendEmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

export interface IEmailService {
  sendAdminLoginOtp(toEmail: string, otpCode: string, adminName: string): Promise<boolean>;
  sendMail(options: SendEmailOptions): Promise<boolean>;
}

export class EmailService implements IEmailService {
  private transporter: nodemailer.Transporter | null = null;
  private isConfigured = false;

  constructor() {
    this.initTransporter();
  }

  private initTransporter() {
    const hasSmtpConfig = Boolean(
      env.SMTP_HOST &&
      env.SMTP_HOST.trim().length > 0 &&
      env.SMTP_USER &&
      env.SMTP_USER.trim().length > 0
    );

    if (hasSmtpConfig) {
      const isGmail = env.SMTP_HOST!.toLowerCase().includes('gmail');
      const sanitizedPass = env.SMTP_PASS ? env.SMTP_PASS.replace(/\s+/g, '') : '';

      if (isGmail) {
        this.transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: env.SMTP_USER!.trim(),
            pass: sanitizedPass
          }
        });
      } else {
        this.transporter = nodemailer.createTransport({
          host: env.SMTP_HOST!.trim(),
          port: env.SMTP_PORT || 587,
          secure: env.SMTP_SECURE || env.SMTP_PORT === 465,
          auth: {
            user: env.SMTP_USER!.trim(),
            pass: sanitizedPass
          },
          tls: {
            rejectUnauthorized: env.NODE_ENV === 'production'
          }
        });
      }
      this.isConfigured = true;
    } else {
      // Stream / JSON transport when SMTP is not configured
      this.transporter = nodemailer.createTransport({
        jsonTransport: true
      });
      this.isConfigured = false;
    }
  }

  async sendMail(options: SendEmailOptions): Promise<boolean> {
    try {
      const from = env.SMTP_FROM || '"CodeK Academy" <no-reply@codek.local>';
      const mailOptions = {
        from,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };

      if (this.isConfigured && this.transporter) {
        await this.transporter.sendMail(mailOptions);
      }

      return true;
    } catch (error) {
      console.error(`[EmailService] Failed to send email to ${options.to}:`, error);
      return false;
    }
  }

  async sendAdminLoginOtp(toEmail: string, otpCode: string, adminName: string): Promise<boolean> {
    const isDevelopment = env.NODE_ENV !== 'production';

    // Development Console Visual Box for clear visibility during local testing
    if (isDevelopment || !this.isConfigured) {
      console.log('\n============================================================');
      console.log('📧 [EMAIL NOTIFICATION] — CodeK 2FA Verification Code');
      console.log('============================================================');
      console.log(`To:         ${toEmail} (${adminName})`);
      console.log(`Subject:    Your Admin Login Verification Code`);
      console.log(`Expires In: 5 minutes`);
      console.log('------------------------------------------------------------');
      console.log(`🔐 Verification Code: [ ${otpCode} ]`);
      console.log('============================================================\n');
    }

    const html = `
<!DOCTYPE html>
<html dir="ltr" lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Admin Login Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0f172a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f8fafc;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #0f172a; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="560" border="0" cellspacing="0" cellpadding="0" style="max-width: 560px; background-color: #1e293b; border-radius: 20px; border: 1px solid #334155; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 20px 32px; text-align: center; background: linear-gradient(180deg, #1e293b 0%, #0f172a 100%); border-bottom: 1px solid #334155;">
              <div style="display: inline-block; width: 48px; height: 48px; line-height: 48px; border-radius: 14px; background: #6366f1; color: #ffffff; font-weight: 900; font-size: 22px; text-align: center; margin-bottom: 12px;">
                C
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.5px;">CodeK Academy</h1>
              <p style="margin: 4px 0 0 0; font-size: 13px; color: #94a3b8;">Two-Factor Authentication Security</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 16px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                Hello <strong style="color: #ffffff;">${adminName}</strong>,
              </p>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #94a3b8; line-height: 1.6;">
                A sign-in attempt was initiated for your administrator account. Use the 6-digit verification code below to complete your login:
              </p>

              <!-- OTP Code Display -->
              <div style="background-color: #0f172a; border: 1px solid #4338ca; border-radius: 16px; padding: 24px; text-align: center; margin-bottom: 24px;">
                <span style="font-family: 'Courier New', Courier, monospace; font-size: 36px; font-weight: 900; letter-spacing: 12px; color: #818cf8; display: inline-block; margin-left: 12px;">
                  ${otpCode}
                </span>
                <div style="margin-top: 8px; font-size: 12px; font-weight: 600; color: #a5b4fc;">
                  Valid for 5 minutes • Single Use Only
                </div>
              </div>

              <!-- Security Notice -->
              <div style="background-color: #1e1b4b; border: 1px solid #3730a3; border-radius: 12px; padding: 14px; margin-bottom: 24px;">
                <p style="margin: 0; font-size: 12px; color: #c7d2fe; line-height: 1.5;">
                  <strong>Security Alert:</strong> If you did not initiate this login request, your password might be compromised. Please change your password immediately.
                </p>
              </div>

              <p style="margin: 0; font-size: 13px; color: #64748b; line-height: 1.5;">
                Best regards,<br>
                <strong style="color: #94a3b8;">CodeK Academy Security Team</strong>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; background-color: #0f172a; border-top: 1px solid #334155; text-align: center;">
              <p style="margin: 0; font-size: 11px; color: #64748b;">
                This is an automated system email from CodeK Academy. Please do not reply directly to this message.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    const text = `
CodeK Academy - Admin Two-Factor Authentication
------------------------------------------------
Hello ${adminName},

Your verification code is: ${otpCode}

This code is valid for 5 minutes and can only be used once.

If you did not request this login, please secure your account immediately.

- CodeK Academy Security Team
`;

    return this.sendMail({
      to: toEmail,
      subject: `[CodeK] ${otpCode} is your Admin Login Verification Code`,
      text,
      html
    });
  }
}

export const emailService = new EmailService();
