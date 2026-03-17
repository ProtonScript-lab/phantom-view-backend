import axios from 'axios';
import logger from '../utils/logger.js';

class EmailService {
  constructor() {
    this.apiKey = process.env.EMAIL_PASSWORD; // API-ключ NotiSend
    this.fromEmail = process.env.EMAIL_FROM || 'noreply@phantom-view.ru';
    this.fromName = 'Phantom View';
    this.apiUrl = 'https://api.notisend.ru/v1/messages'; // эндпоинт отправки
  }

  async sendVerificationCode(to, code) {
    if (!to || !code) {
      throw new Error('Email или код не указан');
    }

    const payload = {
      from: {
        email: this.fromEmail,
        name: this.fromName
      },
      to: [
        { email: to }
      ],
      subject: 'Подтверждение email на Phantom View',
      html: this._getVerificationHtml(code),
      text: `Ваш код подтверждения: ${code}`
    };

    try {
      logger.info(`Попытка отправки email через API NotiSend на ${to}`);
      const response = await axios.post(this.apiUrl, payload, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 секунд таймаут
      });

      if (response.data && response.data.id) {
        logger.info('Email отправлен через API', { to, messageId: response.data.id });
        return response.data;
      } else {
        throw new Error('Неизвестный ответ от API');
      }
    } catch (error) {
      logger.error('Ошибка отправки email через API', {
        to,
        error: error.response?.data || error.message,
        stack: error.stack
      });
      throw new Error(`Не удалось отправить письмо: ${error.message}`);
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
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
    const payload = {
      from: { email: this.fromEmail, name: this.fromName },
      to: [{ email: to }],
      subject: 'Сброс пароля на Phantom View',
      html: this._getResetHtml(resetLink),
      text: `Для сброса пароля перейдите по ссылке: ${resetLink}`
    };

    try {
      const response = await axios.post(this.apiUrl, payload, {
        headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
        timeout: 10000
      });
      logger.info('Письмо сброса пароля отправлено', { to, messageId: response.data.id });
      return response.data;
    } catch (error) {
      logger.error('Ошибка отправки письма сброса пароля', { to, error: error.message });
      throw new Error('Не удалось отправить письмо');
    }
  }

  _getResetHtml(resetLink) {
    return `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color:#ff385c">Сброс пароля</h2>
        <p>Для сброса пароля нажмите кнопку ниже</p>
        <a href="${resetLink}" style="display:inline-block;background:#ff385c;color:white;padding:12px 24px;text-decoration:none;border-radius:30px;margin:20px 0">Сбросить пароль</a>
        <p>Если вы не запрашивали сброс пароля — просто проигнорируйте это письмо.</p>
      </div>
    `;
  }
}

export default new EmailService();