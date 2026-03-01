import dotenv from 'dotenv';
dotenv.config();

const requiredEnv = [
  'DATABASE_URL',
  'JWT_SECRET',
  'YOOKASSA_SHOP_ID',
  'YOOKASSA_SECRET_KEY',
  'UPDATE_SECRET',
  'GIGACHAT_CLIENT_ID',
  'GIGACHAT_CLIENT_SECRET'
];

const missing = requiredEnv.filter(key => !process.env[key]);
if (missing.length) {
  console.error(`❌ Missing environment variables: ${missing.join(', ')}`);
  process.exit(1);
}

export const config = {
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  yooKassa: {
    shopId: process.env.YOOKASSA_SHOP_ID,
    secretKey: process.env.YOOKASSA_SECRET_KEY
  },
  updateSecret: process.env.UPDATE_SECRET,
  gigachat: {
    clientId: process.env.GIGACHAT_CLIENT_ID,
    clientSecret: process.env.GIGACHAT_CLIENT_SECRET
  },
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173'
};