import * as authService from '../services/auth.service.js';
import emailService from '../services/email.service.js';
import logger from '../utils/logger.js';

/**
 * Регистрация нового пользователя
 */
export const register = async (req, res, next) => {
  try {
    const { username, email, password, ref, role, fullName } = req.body;

    // Проверка на существование пользователя с таким username или email
    const existingUser = await authService.findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
    }
    const existingEmail = await authService.findUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    const userId = await authService.registerUser({
      username,
      email,
      password,
      ref,
      role,
      fullName
    });

    // Генерируем и отправляем код верификации email (опционально, будет реализовано позже)
    // await emailService.sendVerificationCode(email, userId);

    res.status(201).json({ id: userId, message: 'Регистрация успешна' });
  } catch (err) {
    logger.error('Ошибка регистрации:', err);
    next(err);
  }
};

/**
 * Вход пользователя
 */
export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await authService.validateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    const token = authService.generateToken(user);
    res.json({ token });
  } catch (err) {
    logger.error('Ошибка логина:', err);
    next(err);
  }
};

/**
 * Отправка кода подтверждения на email текущего пользователя
 */
export const sendVerificationCode = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await authService.findUserById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    if (user.email_verified) {
      return res.status(400).json({ error: 'Email уже подтвержден' });
    }

    // Генерируем и сохраняем код
    const code = await authService.setVerificationCode(userId, user.email);
    
    // Отправляем код на почту
    await emailService.sendVerificationCode(user.email, code);
    
    res.json({ message: 'Код подтверждения отправлен на ваш email' });
  } catch (err) {
    logger.error('Ошибка отправки кода:', err);
    next(err);
  }
};

/**
 * Подтверждение email с помощью кода
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;

    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Введите 6-значный код' });
    }

    const ok = await authService.verifyEmailCode(userId, code);
    
    if (!ok) {
      return res.status(400).json({ error: 'Неверный или просроченный код' });
    }

    res.json({ message: 'Email успешно подтвержден' });
  } catch (err) {
    logger.error('Ошибка подтверждения email:', err);
    next(err);
  }
};