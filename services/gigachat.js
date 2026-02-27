import axios from 'axios';
import https from 'https'; // добавьте этот импорт

class GigaChatService {
  constructor() {
    this.clientId = null;
    this.clientSecret = null;
    this.authUrl = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
    this.apiUrl = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';
    this.accessToken = null;
    this.tokenExpires = null;
  }

  async getAccessToken() {
    if (!this.clientId) {
      this.clientId = process.env.GIGACHAT_CLIENT_ID;
      this.clientSecret = process.env.GIGACHAT_CLIENT_SECRET;
      if (!this.clientId || !this.clientSecret) {
        throw new Error('GIGACHAT_CLIENT_ID и GIGACHAT_CLIENT_SECRET должны быть заданы в .env');
      }
    }

    if (this.accessToken && this.tokenExpires > Date.now()) {
      return this.accessToken;
    }

    try {
      const response = await axios.post(this.authUrl, 
        'scope=GIGACHAT_API_PERS', 
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json',
            'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`
          },
          httpsAgent: new https.Agent({ rejectUnauthorized: false }) // 👈 игнорируем SSL
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpires = Date.now() + (response.data.expires_at - response.data.issued_at) * 1000;
      return this.accessToken;
} catch (error) {
  console.error('Ошибка получения токена GigaChat:', error.message);
  if (error.response) {
    console.error('Статус:', error.response.status);
    console.error('Детали ответа:', error.response.data);
  } else if (error.request) {
    console.error('Запрос был отправлен, но ответ не получен');
  } else {
    console.error('Ошибка настройки запроса:', error.message);
  }
  throw new Error('Не удалось получить токен доступа');
}
  }

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
        headers: { 'Authorization': `Bearer ${token}` },
        httpsAgent: new https.Agent({ rejectUnauthorized: false }) // 👈 и здесь
      });

      const result = response.data.choices[0]?.message?.content;
      if (!result) {
        throw new Error('GigaChat вернул пустой ответ');
      }
      return result;
    } catch (error) {
      console.error('Ошибка генерации текста:', error.message);
      throw new Error('Не удалось получить данные от GigaChat');
    }
  }

  async generatePostIdeas(topic) {
    const prompt = `Придумай 5 идей для постов на тему "${topic}". 
      Каждая идея должна быть краткой, цепляющей и содержать заголовок.
      Формат ответа: просто список через дефис, без лишнего текста.`;
    return await this.generateText(prompt, 'Ты креативный кпирайтер');
  }

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