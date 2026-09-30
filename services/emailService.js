const nodemailer = require('nodemailer');

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'ritiksuthar989@gmail.com').toLowerCase().trim();

/**
 * Creates and configures the nodemailer transporter.
 * Supports Gmail with multiple env variable aliases and automatic space cleanup.
 */
function getTransporter() {
  const emailUser = (process.env.EMAIL_USER || process.env.GMAIL_USER || ADMIN_EMAIL).trim();
  
  // Accept multiple aliases for user convenience
  const rawPass = process.env.EMAIL_PASS || 
                  process.env.EMAIL_PASSWORD || 
                  process.env.GMAIL_APP_PASSWORD || 
                  process.env.APP_PASSWORD || 
                  process.env.SMTP_PASS;

  if (!rawPass || rawPass.includes('your_gmail_app_password') || rawPass.trim() === '') {
    return null;
  }

  // Google displays App Passwords with spaces (e.g. "abcd efgh ijkl mnop").
  // Strip all whitespace, quotes, and carriage returns:
  const cleanPass = rawPass.replace(/['"\s\r\n]/g, '');

  if (cleanPass.length < 8) {
    console.warn('⚠️ [EMAIL SERVICE] Warning: Provided EMAIL_PASS is shorter than 8 characters.');
  }

  // Use direct Gmail SMTP on SSL port 465 for maximum reliability
  return nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: emailUser,
      pass: cleanPass
    },
    tls: {
      rejectUnauthorized: false
    }
  });
}

/**
 * Generate rich, branded HTML email template for OTP verification
 */
function generateOtpHtml(otp, targetEmail) {
  return `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portfolio Admin OTP Verification</title>
  </head>
  <body style="margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f3f4f6; padding: 40px 10px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width: 540px; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e5e7eb;">
            <!-- Header -->
            <tr>
              <td style="background-color: #111827; padding: 32px 30px; text-align: center;">
                <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">
                  Ritik Suthar
                </h1>
                <p style="color: #9ca3af; margin: 6px 0 0 0; font-size: 13px; font-weight: 500; letter-spacing: 0.5px; text-transform: uppercase;">
                  Admin Portfolio Security Portal
                </p>
              </td>
            </tr>

            <!-- Content -->
            <tr>
              <td style="padding: 36px 32px;">
                <h2 style="color: #111827; margin: 0 0 12px 0; font-size: 20px; font-weight: 700;">
                  Authentication One-Time Passcode
                </h2>
                <p style="color: #4b5563; font-size: 15px; line-height: 1.6; margin: 0 0 24px 0;">
                  A login request was initiated for your portfolio admin control panel. Use the verification passcode below to complete your login:
                </p>

                <!-- OTP Code Display Card -->
                <div style="background: linear-gradient(135deg, #111827 0%, #1f2937 100%); border-radius: 12px; padding: 24px; text-align: center; margin-bottom: 24px;">
                  <div style="color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1.5px; margin-bottom: 8px;">
                    Your 6-Digit Passcode
                  </div>
                  <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; color: #38bdf8; letter-spacing: 10px; padding: 4px 0;">
                    ${otp}
                  </div>
                  <div style="color: #d1d5db; font-size: 13px; margin-top: 8px;">
                    ⏱️ Expires in <strong>10 minutes</strong>
                  </div>
                </div>

                <!-- Security Details -->
                <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 14px 16px; border-radius: 6px; margin-bottom: 24px;">
                  <p style="color: #334155; font-size: 13px; margin: 0; line-height: 1.5;">
                    🔒 <strong>Security Notice:</strong> This code was requested for <strong>${targetEmail}</strong>. If you did not initiate this login request, please disregard this email. Your account remains protected.
                  </p>
                </div>

                <p style="color: #6b7280; font-size: 13px; line-height: 1.5; margin: 0;">
                  Best regards,<br>
                  <strong>Ritik Suthar Portfolio System</strong>
                </p>
              </td>
            </tr>

            <!-- Footer -->
            <tr>
              <td style="background-color: #f9fafb; padding: 18px 30px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="color: #9ca3af; font-size: 11px; margin: 0;">
                  Automated security message • Sent at ${new Date().toUTCString()}
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
}

/**
 * Sends the OTP email using nodemailer or logs to console if SMTP is not configured.
 */
async function sendOtpEmail({ to, otp }) {
  const targetEmail = (to || ADMIN_EMAIL).toLowerCase().trim();
  const transporter = getTransporter();

  console.log('\n================================================================');
  console.log(`🔐 [ADMIN AUTH OTP] Target Email: ${targetEmail}`);
  console.log(`🔑 [ADMIN AUTH OTP] Code: [ ${otp} ]`);
  console.log(`⏰ [ADMIN AUTH OTP] Valid for 10 minutes`);
  console.log('================================================================\n');

  if (!transporter) {
    console.log('ℹ️  [EMAIL SERVICE] Gmail App Password (EMAIL_PASS) is not configured in .env.');
    console.log('ℹ️  [EMAIL SERVICE] To send real emails to your inbox, set EMAIL_PASS in server/.env with your 16-character Google App Password.');
    return {
      delivered: false,
      simulated: true,
      otp,
      message: 'OTP logged to server console (SMTP not configured)'
    };
  }

  try {
    const senderEmail = (process.env.EMAIL_USER || process.env.GMAIL_USER || ADMIN_EMAIL).trim();
    console.log(`📤 [EMAIL SERVICE] Connecting to smtp.gmail.com via ${senderEmail}...`);

    const mailOptions = {
      from: `"Ritik Suthar Portfolio Security" <${senderEmail}>`,
      to: targetEmail,
      subject: `Your Admin Login Passcode: ${otp}`,
      text: `Your Ritik Suthar Portfolio Admin login passcode is ${otp}. This code expires in 10 minutes.`,
      html: generateOtpHtml(otp, targetEmail)
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ [EMAIL SERVICE] Live email delivered to ${targetEmail}! Message ID: ${info.messageId}`);
    return {
      delivered: true,
      messageId: info.messageId,
      message: `OTP delivered to ${targetEmail}`
    };
  } catch (err) {
    console.error(`❌ [EMAIL SERVICE] Failed to deliver email to ${targetEmail}:`);
    console.error(`   Error Message: ${err.message}`);
    if (err.code === 'EAUTH' || err.responseCode === 535) {
      console.error(`   👉 Reason: Gmail rejected the credentials. Make sure you use a 16-character Google App Password (not your normal Gmail password).`);
      console.error(`   👉 Link: https://myaccount.google.com/apppasswords`);
    }
    return {
      delivered: false,
      error: err.message,
      otp,
      message: `Email delivery failed: ${err.message}`
    };
  }
}

module.exports = {
  sendOtpEmail,
  generateOtpHtml
};
