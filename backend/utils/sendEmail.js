const nodemailer = require('nodemailer');

// Create transporter function (lazy initialization to ensure env vars are loaded)
function getTransporter() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error('Email credentials not configured. Set EMAIL_USER and EMAIL_PASS in your .env file');
  }

  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // App password for Gmail
    },
  });
}

/**
 * Send email using nodemailer
 * @param {string} to - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html - HTML email body
 * @returns {Promise<void>}
 */
async function sendEmail(to, subject, html) {
  try {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
      const errorMsg = 'Email credentials not configured. Set EMAIL_USER and EMAIL_PASS in your .env file';
      console.error('❌', errorMsg);
      throw new Error(errorMsg);
    }

    console.log(`📧 Attempting to send email to: ${to}`);
    console.log(`📧 Using email: ${process.env.EMAIL_USER}`);
    console.log(`📧 Email pass configured: ${process.env.EMAIL_PASS ? 'Yes (' + process.env.EMAIL_PASS.length + ' chars)' : 'No'}`);

    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"Aegis Trading" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log('✅ Email sent successfully!');
    console.log('   Message ID:', info.messageId);
    console.log('   To:', to);
    return info;
  } catch (error) {
    console.error('❌ Error sending email:');
    console.error('   Error message:', error.message);
    console.error('   Error code:', error.code);
    console.error('   Full error:', error);
    
    // Provide more helpful error messages
    if (error.code === 'EAUTH') {
      throw new Error('Email authentication failed. Check your EMAIL_USER and EMAIL_PASS in .env file. For Gmail, make sure you\'re using an App Password, not your regular password.');
    } else if (error.code === 'ECONNECTION') {
      throw new Error('Could not connect to email server. Check your internet connection and email service settings.');
    } else if (error.message && error.message.includes('Invalid login')) {
      throw new Error('Invalid email credentials. For Gmail, use an App Password (not your regular password).');
    }
    
    throw error;
  }
}

/**
 * Send email verification code
 * @param {string} to - Recipient email address
 * @param {string} code - 6-digit verification code
 * @returns {Promise<void>}
 */
async function sendVerificationEmail(to, code) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code { background: #fff; border: 2px dashed #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .code-number { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔐 Email Verification</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>Thank you for signing up for <strong>Aegis Trading</strong>!</p>
          <p>Please use the following code to verify your email address:</p>
          <div class="code">
            <div class="code-number">${code}</div>
          </div>
          <p>This code will expire in <strong>10 minutes</strong>.</p>
          <p>If you didn't create an account, please ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Aegis Trading. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(to, 'Verify your Aegis Trading account', html);
}

/**
 * Send password reset code
 * @param {string} to - Recipient email address
 * @param {string} code - 6-digit reset code
 * @returns {Promise<void>}
 */
async function sendPasswordResetEmail(to, code) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
        .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
        .code { background: #fff; border: 2px dashed #0ea5e9; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0; }
        .code-number { font-size: 32px; font-weight: bold; color: #0ea5e9; letter-spacing: 5px; }
        .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Password Reset</h1>
        </div>
        <div class="content">
          <p>Hello,</p>
          <p>We received a request to reset your <strong>Aegis Trading</strong> password.</p>
          <p>Use the following code to reset your password:</p>
          <div class="code">
            <div class="code-number">${code}</div>
          </div>
          <p>This code will expire in <strong>10 minutes</strong>.</p>
          <p>If you did not request a password reset, you can ignore this email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Aegis Trading. All rights reserved.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail(to, 'Reset your Aegis Trading password', html);
}

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
};
