import dns from 'dns';
import { promisify } from 'util';
import logger from './logger.js';

const resolveMx = promisify(dns.resolveMx);

// Список одноразовых доменов (можно дополнять)
const disposableDomains = new Set([
  'temp-mail.org', 'guerrillamail.com', '10minutemail.com', 'mailinator.com',
  'yopmail.com', 'trashmail.com', 'sharklasers.com', 'grr.la', 'temp-mail.ru',
  'tempmail.net', 'fakeinbox.com', 'mailnator.com', 'maildrop.cc', 'getairmail.com',
  'tempinbox.com', 'throwawaymail.com', 'spamgourmet.com', 'dispostable.com',
  'mailcatch.com', 'mintemail.com', 'mailmetrash.com', 'spambox.us', 'spamspot.com',
  'tempemail.net', 'mailinator2.com', 'mailinator.net', 'mailinator.org',
  'mailinator.info', 'mailinator.biz', 'mailinator.us',
]);

/**
 * Проверяет email через DNS (MX-запись) и список одноразовых доменов
 * @param {string} email
 * @returns {Promise<{isValid: boolean, reason?: string}>}
 */
export const validateEmailDns = async (email) => {
  // 1. Базовая проверка формата
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return { isValid: false, reason: 'Некорректный формат email' };
  }

  const domain = email.split('@')[1].toLowerCase();

  // 2. Проверка на одноразовые домены
  if (disposableDomains.has(domain)) {
    return { isValid: false, reason: 'Одноразовые email запрещены' };
  }

  // 3. Проверка MX-записи
  try {
    const mxRecords = await resolveMx(domain);
    if (mxRecords && mxRecords.length > 0) {
      return { isValid: true };
    } else {
      return { isValid: false, reason: 'Домен не принимает почту' };
    }
  } catch (error) {
    logger.warn('DNS проверка провалилась для домена', { domain, error: error.message });
    return { isValid: false, reason: 'Домен не найден' };
  }
};