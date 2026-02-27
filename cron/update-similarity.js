console.log('Скрипт запущен, начинаем...');

import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

console.log('Переменные окружения загружены');
console.log('BACKEND_URL =', process.env.BACKEND_URL);
console.log('UPDATE_SECRET =', process.env.UPDATE_SECRET ? 'установлен' : 'не установлен');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const UPDATE_SECRET = process.env.UPDATE_SECRET;

async function updateSimilarity() {
  console.log('Запуск обновления матрицы сходства...');
  try {
    console.log('Отправка запроса к', `${BACKEND_URL}/api/update-similarity`);
    const response = await axios.post(
      `${BACKEND_URL}/api/update-similarity`,
      {},
      {
        headers: { 'x-update-secret': UPDATE_SECRET }
      }
    );
    console.log('Обновление выполнено успешно. Статус:', response.status);
  } catch (error) {
    console.error('Ошибка при обновлении:', error.message);
    if (error.response) {
      console.error('Детали:', error.response.data);
    }
  }
}

// Проверка, запущен ли файл напрямую
const __filename = fileURLToPath(import.meta.url);
if (__filename === path.resolve(process.argv[1])) {
  console.log('Запуск из командной строки');
  updateSimilarity();
}

export default updateSimilarity;