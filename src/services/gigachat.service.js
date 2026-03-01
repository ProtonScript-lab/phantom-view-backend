import axios from 'axios';
import https from 'https';
import crypto from 'crypto';
import { config } from '../config/env.js';
import logger from '../utils/logger.js';

class GigaChatService {
  constructor() {
    this.clientId = config.gigachat.clientId;
    this.clientSecret = config.gigachat.clientSecret;
    this.authUrl = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
    this.apiUrl = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
    this.accessToken = null;
    this.tokenExpires = 0;
  }

  async getAccessToken() {
    if (this.accessToken && Date.now() < this.tokenExpires) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');

    try {
      const response = await axios.post(
        this.authUrl,
        new URLSearchParams({ scope: 'GIGACHAT_API_PERS', grant_type: 'client_credentials' }).toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Authorization': `Basic ${auth}`,
            'RqUID': crypto.randomUUID()
          },
          httpsAgent: new https.Agent({ rejectUnauthorized: config.nodeEnv === 'production' })
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpires = Date.now() + (response.data.expires_in * 1000 - 10000);
      return this.accessToken;
    } catch (error) {
      logger.error('Ошибка получения токена GigaChat');
      if (error.response) {
        logger.error(`Статус: ${error.response.status}`, error.response.data);
      } else {
        logger.error(error.message);
      }
      throw new Error('Не удалось получить токен доступа');
    }
  }

  async generateText(prompt, systemPrompt = 'Ты полезный ассистент') {
    try {
      const token = await this.getAccessToken();
      const response = await axios.post(
        this.apiUrl,
        {
          model: 'GigaChat',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: prompt }
          ],
          temperature: 0.7,
          max_tokens: 500
        },
        {
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          httpsAgent: new https.Agent({ rejectUnauthorized: config.nodeEnv === 'production' })
        }
      );

      const result = response.data.choices?.[0]?.message?.content;
      if (!result) throw new Error('GigaChat вернул пустой ответ');
      return result;
    } catch (error) {
      logger.error('Ошибка генерации текста');
      if (error.response) {
        logger.error(`Статус: ${error.response.status}`, error.response.data);
      } else {
        logger.error(error.message);
      }
      throw new Error('Не удалось получить данные от GigaChat');
    }
  }

  async generatePostIdeas(topic) {
    const prompt = `Придумай 5 идей для постов на тему "${topic}". 
Каждая идея должна быть краткой, цепляющей и содержать заголовок.
Формат ответа: просто список через дефис, без лишнего текста.`;
    return this.generateText(prompt, 'Ты креативный копирайтер');
  }

  async getTrends() {
    const prompt = `Какие темы сейчас в топе в социальных сетях по категориям:
- Фитнес
- Музыка
- Кулинария
- Образование
Дай краткий список из 5 пунктов.`;
    return this.generateText(prompt, 'Ты маркетолог-аналитик');
  }
}

export default new GigaChatService();