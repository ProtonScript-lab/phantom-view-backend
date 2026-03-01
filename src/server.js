import http from 'http'; // добавить импорт
import app from './app.js';
import { config } from './config/env.js';
import logger from './utils/logger.js';
import { updateSimilarity } from './services/similarity.service.js';
import cron from 'node-cron';
import { Server } from 'socket.io'; // импорт Socket.io
import jwt from 'jsonwebtoken'; // для аутентификации

const PORT = config.port;

// Создаём HTTP-сервер на основе Express app
const server = http.createServer(app);

// Настраиваем Socket.io с CORS
const io = new Server(server, {
  cors: {
    origin: config.frontendUrl, // адрес вашего фронтенда
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// Middleware для аутентификации сокетов через JWT
io.use((socket, next) => {
  const token = socket.handshake.auth.token; // токен передаётся при подключении
  if (!token) {
    return next(new Error('Authentication error: token missing'));
  }
  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) {
      return next(new Error('Authentication error: invalid token'));
    }
    // Сохраняем данные пользователя в socket для дальнейшего использования
    socket.userId = user.id;
    socket.userRole = user.role;
    next();
  });
});

// Обработка подключений
io.on('connection', (socket) => {
  logger.info(`User connected: ${socket.userId}`);

  // Присоединение к комнате диалога
  socket.on('join-conversation', (conversationId) => {
    socket.join(`conversation:${conversationId}`);
    logger.info(`User ${socket.userId} joined conversation ${conversationId}`);
  });

  // Выход из комнаты (опционально)
  socket.on('leave-conversation', (conversationId) => {
    socket.leave(`conversation:${conversationId}`);
  });

  // Отправка сообщения
  socket.on('send-message', async (data) => {
    try {
      // data должен содержать { conversationId, content, type, mediaUrl? }
      const { conversationId, content, type = 'text', mediaUrl } = data;

      // Сохраняем сообщение в БД через сервис
      const messageService = await import('./services/message.service.js');
      const message = await messageService.sendMessage(
        socket.userId,
        conversationId,
        content,
        type,
        mediaUrl
      );

      // Отправляем сообщение всем в комнате, включая отправителя
      io.to(`conversation:${conversationId}`).emit('new-message', message);
    } catch (error) {
      logger.error('Ошибка при отправке сообщения через socket:', error);
      socket.emit('error', 'Не удалось отправить сообщение');
    }
  });

  // Отключение
  socket.on('disconnect', () => {
    logger.info(`User disconnected: ${socket.userId}`);
  });
});

// Обработка необработанных rejections (оставляем как есть)
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection:', err);
});

// Планировщик (оставляем как есть)
cron.schedule('0 3 * * *', async () => {
  logger.info('Запуск ежедневного обновления рекомендаций...');
  try {
    await updateSimilarity();
    logger.info('Обновление выполнено успешно');
  } catch (error) {
    logger.error('Ошибка при плановом обновлении:', error);
  }
});

// Запускаем HTTP-сервер вместо app.listen
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});