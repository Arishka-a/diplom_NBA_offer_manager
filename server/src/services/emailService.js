const nodemailer = require('nodemailer');

// Email configuration
const emailConfig = {
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT) || 587,
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
};

// Create transporter
let transporter = null;

function getTransporter() {
  if (!transporter) {
    // Check if email is configured
    if (!process.env.EMAIL_USER || process.env.EMAIL_USER === 'your-email@gmail.com') {
      throw new Error('Email not configured. Please set EMAIL_USER and EMAIL_PASSWORD in .env file.');
    }
    transporter = nodemailer.createTransporter(emailConfig);
  }
  return transporter;
}

/**
 * Send password reset email
 * @param {string} email - User email address
 * @param {string} resetToken - Password reset token
 * @param {string} userName - User's name
 * @returns {Promise<Object>} Email send result
 */
async function sendPasswordResetEmail(email, resetToken, userName = 'Пользователь') {
  const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

  const mailOptions = {
    from: `"NBA Offer Manager" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Восстановление пароля - NBA Offer Manager',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button {
            display: inline-block;
            padding: 12px 30px;
            margin: 20px 0;
            background-color: #4CAF50;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
          }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #777; }
          .warning { color: #d32f2f; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Восстановление пароля</h1>
          </div>
          <div class="content">
            <p>Здравствуйте, ${userName}!</p>
            <p>Вы запросили восстановление пароля для вашей учетной записи в системе <strong>NBA Offer Manager</strong>.</p>
            <p>Для сброса пароля нажмите на кнопку ниже:</p>
            <p style="text-align: center;">
              <a href="${resetUrl}" class="button">Восстановить пароль</a>
            </p>
            <p>Или скопируйте и вставьте эту ссылку в браузер:</p>
            <p style="word-break: break-all; background: #fff; padding: 10px; border: 1px solid #ddd;">
              ${resetUrl}
            </p>
            <p class="warning">⚠️ Эта ссылка действительна в течение 1 часа.</p>
            <p>Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо. Ваш пароль останется без изменений.</p>
          </div>
          <div class="footer">
            <p>С уважением,<br>Команда NBA Offer Manager</p>
            <p>Это автоматическое письмо. Пожалуйста, не отвечайте на него.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Здравствуйте, ${userName}!

Вы запросили восстановление пароля для вашей учетной записи в системе NBA Offer Manager.

Для сброса пароля перейдите по ссылке:
${resetUrl}

⚠️ Эта ссылка действительна в течение 1 часа.

Если вы не запрашивали восстановление пароля, просто проигнорируйте это письмо.

С уважением,
Команда NBA Offer Manager
    `
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log('Password reset email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw new Error('Не удалось отправить email. Проверьте настройки почты.');
  }
}

/**
 * Send password changed confirmation email
 * @param {string} email - User email address
 * @param {string} userName - User's name
 * @returns {Promise<Object>} Email send result
 */
async function sendPasswordChangedEmail(email, userName = 'Пользователь') {
  const mailOptions = {
    from: `"NBA Offer Manager" <${process.env.EMAIL_FROM || process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Пароль успешно изменен - NBA Offer Manager',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { padding: 20px; text-align: center; font-size: 12px; color: #777; }
          .warning { color: #d32f2f; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✓ Пароль изменен</h1>
          </div>
          <div class="content">
            <p>Здравствуйте, ${userName}!</p>
            <p>Ваш пароль в системе <strong>NBA Offer Manager</strong> был успешно изменен.</p>
            <p>Теперь вы можете войти в систему, используя новый пароль.</p>
            <p class="warning">⚠️ Если вы не меняли пароль, немедленно свяжитесь с администратором системы!</p>
          </div>
          <div class="footer">
            <p>С уважением,<br>Команда NBA Offer Manager</p>
            <p>Это автоматическое письмо. Пожалуйста, не отвечайте на него.</p>
          </div>
        </div>
      </body>
      </html>
    `,
    text: `
Здравствуйте, ${userName}!

Ваш пароль в системе NBA Offer Manager был успешно изменен.

Теперь вы можете войти в систему, используя новый пароль.

⚠️ Если вы не меняли пароль, немедленно свяжитесь с администратором системы!

С уважением,
Команда NBA Offer Manager
    `
  };

  try {
    const info = await getTransporter().sendMail(mailOptions);
    console.log('Password changed confirmation email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending password changed email:', error);
    // Don't throw error here - password is already changed
    return { success: false, error: error.message };
  }
}

/**
 * Verify email configuration
 * @returns {Promise<boolean>} True if email is configured correctly
 */
async function verifyEmailConfig() {
  try {
    await getTransporter().verify();
    console.log('Email server is ready to send messages');
    return true;
  } catch (error) {
    console.error('Email configuration error:', error);
    return false;
  }
}

module.exports = {
  sendPasswordResetEmail,
  sendPasswordChangedEmail,
  verifyEmailConfig
};
