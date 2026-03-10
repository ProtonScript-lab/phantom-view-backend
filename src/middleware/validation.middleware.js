import { body, validationResult } from 'express-validator'

export const validateRegister = [
  body('username')
    .isLength({ min: 3, max: 20 }).withMessage('Имя пользователя должно быть от 3 до 20 символов')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Имя может содержать только буквы, цифры и _'),
  body('email').isEmail().withMessage('Некорректный email').normalizeEmail(),
  body('password').isLength({ min: 6 }).withMessage('Пароль должен быть не менее 6 символов'),
  body('role').optional().isIn(['subscriber', 'creator']).withMessage('Роль должна быть subscriber или creator'),
  body('fullName').optional().isLength({ max: 100 }).withMessage('Имя слишком длинное'),
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
    next()
  }
]

export const validateLogin = [
  body('username').notEmpty().withMessage('Имя обязательно'),
  body('password').notEmpty().withMessage('Пароль обязателен'),
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
    next()
  }
]

// Валидация для отправки сообщения
export const validateSendMessage = [
  body('conversationId').isInt().withMessage('Некорректный ID диалога'),
  body('content').optional().trim(),
  body('mediaUrl').optional().isURL().withMessage('Некорректный URL медиа'),
  body('type').optional().isIn(['text', 'image', 'video', 'voice']).withMessage('Тип сообщения должен быть text, image, video или voice'),
  (req, res, next) => {
    if (!req.body.content && !req.body.mediaUrl) {
      return res.status(400).json({ error: 'Сообщение не может быть пустым' })
    }
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
    next()
  }
]

// Валидация для вывода средств
export const validateWithdraw = [
  body('amount').isInt({ min: 1 }).withMessage('Сумма должна быть положительным числом'),
  body('wallet').notEmpty().withMessage('Укажите кошелёк для вывода'),
  (req, res, next) => {
    const errors = validationResult(req)
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() })
    next()
  }
]