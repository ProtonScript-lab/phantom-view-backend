import { updateSimilarity } from '../services/similarity.service.js';
import logger from '../utils/logger.js';

(async () => {
  try {
    logger.info('Запуск ручного обновления матрицы сходства...');
    await updateSimilarity();
    logger.info('Обновление выполнено успешно');
  } catch (error) {
    logger.error('Ошибка:', error);
  }
})();