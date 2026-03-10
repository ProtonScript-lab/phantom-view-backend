import * as paymentService from '../services/payment.service.js'
import logger from '../utils/logger.js'

/**
 * Создание платежа (подписка или пополнение баланса)
 */
export const createPayment = async (req, res, next) => {
  try {
    const userId = req.user?.id
    const { amount, creatorId, type = 'subscription' } = req.body

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Некорректная сумма платежа' })
    }

    const paymentData = await paymentService.createPayment(
      userId,
      amount,
      creatorId,
      type
    )

    return res.json(paymentData)
  } catch (err) {
    logger.error('Ошибка создания платежа', err)
    return next(err)
  }
}

/**
 * Webhook от YooKassa
 */
export const paymentCallback = async (req, res) => {
  try {
    const event = req.body

    await paymentService.handlePaymentCallback(event)

    return res.json({ success: true })
  } catch (err) {
    logger.error('Ошибка обработки webhook YooKassa', err)

    return res.status(500).json({
      error: 'Internal Server Error'
    })
  }
}

/**
 * Запрос на вывод средств
 */
export const withdrawRequest = async (req, res, next) => {
  try {
    const userId = req.user?.id
    const { amount, wallet } = req.body

    if (!userId) {
      return res.status(401).json({ message: 'Пользователь не авторизован' })
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: 'Некорректная сумма вывода' })
    }

    if (!wallet) {
      return res.status(400).json({ message: 'Не указан кошелёк для вывода' })
    }

    const request = await paymentService.createWithdrawRequest(
      userId,
      amount,
      wallet
    )

    return res.json(request)
  } catch (err) {
    logger.error('Ошибка запроса на вывод средств', err)
    return next(err)
  }
}
