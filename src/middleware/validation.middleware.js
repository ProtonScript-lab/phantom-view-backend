import { body, validationResult } from 'express-validator';

export const validateRegister = [
  body('username')
    .isLength({ min: 3, max: 20 }).withMessage('Имя пользователя должно быть от 3 до 20 символов')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Имя может содержать только буквы, цифры и _'),
  body('email')
    .isEmail().withMessage('Некорректный email')
    .normalizeEmail(),
  body('password')
    .isLength({ min: 6 }).withMessage('Пароль должен быть не менее 6 символов')
    .matches(/[A-Z]/).withMessage('Пароль должен содержать хотя бы одну заглавную букву')
    .matches(/[0-9]/).withMessage('Пароль должен содержать хотя бы одну цифру'),
  body('role')
    .optional()
    .isIn(['subscriber', 'creator']).withMessage('Роль должна быть subscriber или creator'),
  body('fullName')
    .optional()
    .isLength({ max: 100 }).withMessage('Имя слишком длинное'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

export const validateLogin = [
  body('username').notEmpty().withMessage('Имя обязательно'),
  body('password').notEmpty().withMessage('Пароль обязателен'),
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    next();
  }
];

// Другие валидаторы для создания поста, платежей и т.д.