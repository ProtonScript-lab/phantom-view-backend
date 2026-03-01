import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT) || 465,
      secure: true, // true для 465, false для 587
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        // не обязательно, но иногда помогает избежать ошибок
        rejectUnauthorized: false,
      },
    });

    this.from = process.env.EMAIL_FROM;
    this.frontendUrl = process.env.FRONTEND_URL;
  }

  /**
   * Отправка кода подтверждения email
   * @param {string} to - email получателя
   * @param {string} code - 6-значный код
   * @returns {Promise<void>}
   */
  async sendVerificationCode(to, code) {
    const mailOptions = {
      from: `"Phantom View" <${this.from}>`,
      to,
      subject: 'Подтверждение email на Phantom View',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff385c;">Добро пожаловать в Phantom View!</h2>
          <p>Для подтверждения email введите следующий код:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; font-size: 32px; letter-spacing: 5px; font-weight: bold; border-radius: 8px;">
            ${code}
          </div>
          <p>Код действителен в течение 30 минут.</p>
          <p>Если вы не регистрировались на нашем сайте, просто проигнорируйте это письмо.</p>
          <hr>
          <p style="color: #888; font-size: 12px;">Phantom View — платформа для создателей контента</p>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Email отправлен на ${to}, messageId: ${info.messageId}`);
    } catch (error) {
      logger.error('Ошибка отправки email:', error);
      throw new Error('Не удалось отправить письмо. Попробуйте позже.');
    }
  }

  /**
   * Отправка ссылки для сброса пароля (опционально, для будущего)
   */
  async sendPasswordReset(to, token) {
    const resetLink = `${this.frontendUrl}/reset-password?token=${token}`;
    const mailOptions = {
      from: `"Phantom View" <${this.from}>`,
      to,
      subject: 'Сброс пароля на Phantom View',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff385c;">Сброс пароля</h2>
          <p>Для сброса пароля нажмите на кнопку ниже:</p>
          <a href="${resetLink}" style="display: inline-block; background: #ff385c; color: white; padding: 12px 24px; text-decoration: none; border-radius: 30px; margin: 20px 0;">Сбросить пароль</a>
          <p>Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info(`Письмо для сброса пароля отправлено на ${to}`);
    } catch (error) {
      logger.error('Ошибка отправки письма для сброса пароля:', error);
      throw new Error('Не удалось отправить письмо');
    }
  }

  /**
   * Проверка подключения к SMTP (для тестирования)
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('SMTP подключение работает');
      return true;
    } catch (error) {
      logger.error('Ошибка подключения к SMTP:', error);
      return false;
    }
  }
}

export default new EmailService();