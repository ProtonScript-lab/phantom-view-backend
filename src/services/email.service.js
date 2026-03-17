import nodemailer from 'nodemailer';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    const host = process.env.EMAIL_HOST || 'smtp.notisend.ru';
    const port = parseInt(process.env.EMAIL_PORT) || 587;
    const secure = port === 465;

    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      logger.warn('SMTP переменные окружения (EMAIL_USER, EMAIL_PASSWORD) не заданы');
    }

    this.transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
      tls: {
        rejectUnauthorized: false,
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    });

    this.from = process.env.EMAIL_FROM || process.env.EMAIL_USER;
    this.frontendUrl = process.env.FRONTEND_URL || '';
  }

  /**
   * Отправка кода подтверждения с повторными попытками
   * @param {string} to - Email получателя
   * @param {string} code - 6-значный код
   * @param {number} retries - количество повторных попыток (по умолчанию 2)
   */
  async sendVerificationCode(to, code, retries = 2) {
    if (!to || !code) {
      throw new Error('Email или код не указан');
    }

    const mailOptions = {
      from: `"Phantom View" <${this.from}>`,
      to,
      subject: 'Подтверждение email на Phantom View',
      html: this._getVerificationHtml(code),
    };

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
      try {
        logger.info(`Попытка отправки email на ${to} (попытка ${attempt})`);
        const info = await this.transporter.sendMail(mailOptions);
        logger.info('Email отправлен', { to, messageId: info.messageId });
        return info;
      } catch (error) {
        logger.error(`Ошибка отправки email (попытка ${attempt})`, { to, error: error.message });
        if (attempt === retries + 1) {
          throw new Error(`Не удалось отправить письмо: ${error.message}`);
        }
        // Пауза перед повторной попыткой
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  _getVerificationHtml(code) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #ff385c;">Добро пожаловать в Phantom View</h2>
        <p>Для подтверждения email введите следующий код</p>
        <div style="background:#f5f5f5;padding:20px;text-align:center;font-size:32px;letter-spacing:6px;font-weight:bold;border-radius:8px">
          ${code}
        </div>
        <p>Код действителен в течение 30 минут.</p>
        <p>Если вы не регистрировались на нашем сайте — просто проигнорируйте это письмо.</p>
        <hr>
        <p style="color:#888;font-size:12px">Phantom View — платформа для создателей контента</p>
      </div>
    `;
  }

  async sendPasswordReset(to, token) {
    if (!to || !token) throw new Error('Email или token не указан');
    const resetLink = `${this.frontendUrl}/reset-password?token=${token}`;
    const mailOptions = {
      from: `"Phantom View" <${this.from}>`,
      to,
      subject: 'Сброс пароля на Phantom View',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color:#ff385c">Сброс пароля</h2>
          <p>Для сброса пароля нажмите кнопку ниже</p>
          <a href="${resetLink}" style="display:inline-block;background:#ff385c;color:white;padding:12px 24px;text-decoration:none;border-radius:30px;margin:20px 0">Сбросить пароль</a>
          <p>Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.</p>
        </div>
      `,
    };
    try {
      const info = await this.transporter.sendMail(mailOptions);
      logger.info('Письмо сброса пароля отправлено', { to, messageId: info.messageId });
      return info;
    } catch (error) {
      logger.error('Ошибка отправки письма сброса пароля', { to, error: error.message });
      throw new Error('Не удалось отправить письмо');
    }
  }

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