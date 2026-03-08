
import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    const port = parseInt(process.env.EMAIL_PORT) || 465;

    if (!process.env.EMAIL_HOST || !process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      logger.warn('SMTP переменные окружения не заданы');
    }

    this.transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port,
      secure: port === 465,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
    });

    this.from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    this.frontendUrl = process.env.FRONTEND_URL || '';
  }

  /**
   * Отправка кода подтверждения email
   */
  async sendVerificationCode(to, code) {
    if (!to || !code) {
      throw new Error('Email или код не указан');
    }

    const mailOptions = {
      from: `"Phantom View" <${this.from}>`,
      to,
      subject: 'Подтверждение email на Phantom View',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #ff385c;">Добро пожаловать в Phantom View</h2>
          <p>Для подтверждения email введите следующий код</p>
          
          <div style="background:#f5f5f5;padding:20px;text-align:center;font-size:32px;letter-spacing:6px;font-weight:bold;border-radius:8px">
            ${code}
          </div>

          <p>Код действителен в течение 30 минут.</p>
          <p>Если вы не регистрировались на нашем сайте — просто проигнорируйте это письмо.</p>

          <hr>

          <p style="color:#888;font-size:12px">
            Phantom View — платформа для создателей контента
          </p>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Email отправлен', {
        to,
        messageId: info.messageId
      });

      return info;
    } catch (error) {
      logger.error('Ошибка отправки email', {
        to,
        error: error.message
      });

      throw new Error('Не удалось отправить письмо. Попробуйте позже.');
    }
  }

  /**
   * Отправка письма для сброса пароля
   */
  async sendPasswordReset(to, token) {
    if (!to || !token) {
      throw new Error('Email или token не указан');
    }

    const resetLink = `${this.frontendUrl}/reset-password?token=${token}`;

    const mailOptions = {
      from: `"Phantom View" <${this.from}>`,
      to,
      subject: 'Сброс пароля на Phantom View',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color:#ff385c">Сброс пароля</h2>

          <p>Для сброса пароля нажмите кнопку ниже</p>

          <a href="${resetLink}" 
             style="display:inline-block;background:#ff385c;color:white;padding:12px 24px;text-decoration:none;border-radius:30px;margin:20px 0">
             Сбросить пароль
          </a>

          <p>Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.</p>
        </div>
      `,
    };

    try {
      const info = await this.transporter.sendMail(mailOptions);

      logger.info('Письмо сброса пароля отправлено', {
        to,
        messageId: info.messageId
      });

      return info;
    } catch (error) {
      logger.error('Ошибка отправки письма сброса пароля', {
        to,
        error: error.message
      });

      throw new Error('Не удалось отправить письмо');
    }
  }

  /**
   * Проверка подключения к SMTP
   */
  async verifyConnection() {
    try {
      await this.transporter.verify();
      logger.info('SMTP подключение успешно');
      return true;
    } catch (error) {
      logger.error('Ошибка подключения SMTP', error);
      return false;
    }
  }
}

export default new EmailService();
