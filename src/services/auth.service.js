import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { pool } from '../models/db.js';
import { config } from '../config/env.js';
import { generateRandomCode } from '../utils/helpers.js';
import logger from '../utils/logger.js';

export const registerUser = async ({ username, email, password, ref, role, fullName }) => {
  const hashedPassword = await bcrypt.hash(password, 10);
  const result = await pool.query(
    `INSERT INTO users (username, email, password, referred_by, role, full_name)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [username, email, hashedPassword, ref || null, role || 'subscriber', fullName]
  );
  return result.rows[0].id;
};

export const findUserByUsername = async (username) => {
  const result = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
  return result.rows[0];
};

export const findUserByEmail = async (email) => {
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  return result.rows[0];
};

export const validateUser = async (username, password) => {
  const user = await findUserByUsername(username);
  if (!user) return null;
  const match = await bcrypt.compare(password, user.password);
  return match ? user : null;
};

export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
};

/**
 * Установка кода подтверждения для пользователя
 * @param {number} userId 
 * @param {string} email 
 * @returns {Promise<string>} сгенерированный код
 */
export const setVerificationCode = async (userId, email) => {
  const code = generateRandomCode(); // 6 цифр
  const expires = new Date(Date.now() + 30 * 60 * 1000); // +30 минут
  await pool.query(
    'UPDATE users SET verification_code = $1, code_expires = $2 WHERE id = $3',
    [code, expires, userId]
  );
  return code;
};

/**
 * Проверка кода подтверждения
 * @param {number} userId 
 * @param {string} code 
 * @returns {Promise<boolean>}
 */
export const verifyEmailCode = async (userId, code) => {
  const result = await pool.query(
    'SELECT * FROM users WHERE id = $1 AND verification_code = $2 AND code_expires > NOW()',
    [userId, code]
  );
  if (result.rows.length === 0) return false;
  
  await pool.query(
    'UPDATE users SET email_verified = TRUE, verification_code = NULL, code_expires = NULL WHERE id = $1',
    [userId]
  );
  return true;
};

/**
 * Получение пользователя по ID (для отправки кода)
 */
export const findUserById = async (id) => {
  const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
  return result.rows[0];
};