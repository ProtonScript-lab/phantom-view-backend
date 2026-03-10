import { updateSimilarity } from '../services/similarity.service.js'
import logger from '../utils/logger.js'

async function run() {
  try {
    logger.info('Запуск ручного обновления матрицы сходства')

    await updateSimilarity()

    logger.info('Обновление матрицы сходства выполнено успешно')
    process.exit(0)
  } catch (error) {
    logger.error('Ошибка обновления матрицы сходства', error)
    process.exit(1)
  }
}

run()
