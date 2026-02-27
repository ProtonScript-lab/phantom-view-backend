import axios from 'axios';
import jwt from 'jsonwebtoken';

class GigaChatService {
  constructor() {
    this.clientId = process.env.GIGACHAT_CLIENT_ID;
    this.clientSecret = process.env.GIGACHAT_CLIENT_SECRET;
    this.authUrl = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
    this.apiUrl = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
    this.accessToken = null;
    this.tokenExpires = null;
  }

  // Получение токена доступа
  async getAccessToken() {
    // Если токен ещё действителен, возвращаем его
    if (this.accessToken && this.tokenExpires > Date.now()) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(this.authUrl, 
        'scope=GIGACHAT_API_PERS', {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
        }
      });

      this.accessToken = response.data.access_token;
      this.tokenExpires = Date.now() + (response.data.expires_at - response.data.issued_at) * 1000;
      return this.accessToken;
    } catch (error) {
      console.error('Ошибка получения токена GigaChat:', error);
      throw error;
    }
  }

  // Генерация текста
  async generateText(prompt, systemPrompt = 'Ты полезный ассистент') {
    try {
      const token = await this.getAccessToken();
      
      const response = await axios.post(this.apiUrl, {
        model: 'GigaChat',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 500
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error('Ошибка генерации текста:', error);
      return null;
    }
  }

  // Генерация идей для постов
  async generatePostIdeas(topic) {
    const prompt = `Придумай 5 идей для постов на тему "${topic}". 
      Каждая идея должна быть краткой, цепляющей и содержать заголовок.
      Формат ответа: просто список через дефис, без лишнего текста.`;
    
    return await this.generateText(prompt, 'Ты креативный копирайтер');
  }

  // Анализ трендов (имитация через AI)
  async getTrends() {
    const prompt = `Какие темы сейчас в топе в социальных сетях по категориям:
      - Фитнес
      - Музыка
      - Кулинария
      - Образование
      Дай краткий список из 5 пунктов.`;
    
    return await this.generateText(prompt, 'Ты маркетолог-аналитик');
  }
}

export default new GigaChatService();