import * as authService from '../services/auth.service.js';
import emailService from '../services/email.service.js';
import { validateEmailDns } from '../utils/dnsValidator.js';
import logger from '../utils/logger.js';

export const register = async (req, res, next) => {
  try {
    const { username, email, password, ref, role, fullName } = req.body;

    // === ШАГ 1: Проверка уникальности username и email ===
    const existingUser = await authService.findUserByUsername(username);
    if (existingUser) {
      return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
    }

    const existingEmail = await authService.findUserByEmail(email);
    if (existingEmail) {
      return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
    }

    // === ШАГ 2: DNS-валидация email (если падает, пропускаем, но логируем) ===
    try {
      const validation = await validateEmailDns(email);
      if (!validation.isValid) {
        return res.status(400).json({ error: validation.reason || 'Указанный email недействителен' });
      }
    } catch (dnsErr) {
      logger.warn('DNS-валидация не удалась, но регистрация продолжается', { email, error: dnsErr.message });
      // Если DNS не работает, пропускаем проверку
    }

    // === ШАГ 3: Регистрация пользователя ===
    const userId = await authService.registerUser({
      username,
      email,
      password,
      ref,
      role,
      fullName
    });

    // === ШАГ 4: Отправка кода подтверждения (не блокирует регистрацию) ===
    try {
      const code = await authService.setVerificationCode(userId);
      await emailService.sendVerificationCode(email, code);
    } catch (emailErr) {
      logger.error('Не удалось отправить код подтверждения, но пользователь создан', emailErr);
    }

    res.status(201).json({
      id: userId,
      message: 'Регистрация успешна. На ваш email отправлен код подтверждения.'
    });

  } catch (err) {
    if (err.code === '23505') {
      if (err.constraint?.includes('username')) {
        return res.status(400).json({ error: 'Пользователь с таким именем уже существует' });
      }
      if (err.constraint?.includes('email')) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }
      return res.status(400).json({ error: 'Данные уже используются' });
    }
    logger.error('Ошибка регистрации', err);
    next(err);
  }
};

export const login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const user = await authService.validateUser(username, password);
    if (!user) {
      return res.status(401).json({ error: 'Неверное имя пользователя или пароль' });
    }

    // Проверяем подтверждение email
    if (!user.email_verified) {
      return res.status(403).json({
        error: 'Email не подтвержден. Пожалуйста, подтвердите email.',
        email: user.email
      });
    }

    const token = authService.generateToken(user);
    res.json({ token });
  } catch (err) {
    logger.error('Ошибка логина', err);
    next(err);
  }
};

export const sendVerificationCode = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await authService.findUserById(userId);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.email_verified) return res.status(400).json({ error: 'Email уже подтвержден' });

    const code = await authService.setVerificationCode(userId);
    await emailService.sendVerificationCode(user.email, code);
    res.json({ message: 'Код подтверждения отправлен на ваш email' });
  } catch (err) {
    logger.error('Ошибка отправки кода', err);
    next(err);
  }
};

export const verifyEmail = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { code } = req.body;
    if (!code || code.length !== 6) {
      return res.status(400).json({ error: 'Введите 6-значный код' });
    }
    const ok = await authService.verifyEmailCode(userId, code);
    if (!ok) return res.status(400).json({ error: 'Неверный или просроченный код' });
    res.json({ message: 'Email успешно подтвержден' });
  } catch (err) {
    logger.error('Ошибка подтверждения email', err);
    next(err);
  }
};

// Публичное подтверждение email (без токена) – для страницы верификации
export const verifyEmailPublic = async (req, res, next) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ error: 'Email и код обязательны' });
    }
    const user = await authService.findUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.email_verified) return res.status(400).json({ error: 'Email уже подтвержден' });
    const ok = await authService.verifyEmailCode(user.id, code);
    if (!ok) return res.status(400).json({ error: 'Неверный или просроченный код' });
    res.json({ message: 'Email успешно подтвержден' });
  } catch (err) {
    logger.error('Ошибка публичного подтверждения email', err);
    next(err);
  }
};

// Повторная отправка кода (публичная)
export const resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email обязателен' });

    const user = await authService.findUserByEmail(email);
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
    if (user.email_verified) return res.status(400).json({ error: 'Email уже подтвержден' });

    const code = await authService.setVerificationCode(user.id);
    await emailService.sendVerificationCode(email, code);
    res.json({ message: 'Код отправлен повторно' });
  } catch (err) {
    logger.error('Ошибка повторной отправки кода', err);
    next(err);
  }
};