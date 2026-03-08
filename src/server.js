
import http from 'http';
import app from './app.js';
import { config } from './config/env.js';
import logger from './utils/logger.js';
import { updateSimilarity } from './services/similarity.service.js';
import cron from 'node-cron';
import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';

const PORT = config.port;

// Создаём HTTP сервер на основе Express
const server = http.createServer(app);

// Настройка Socket.io
const io = new Server(server, {
  cors: {
    origin: config.frontendUrl,
    credentials: true,
    methods: ["GET", "POST"]
  }
});

// JWT аутентификация сокетов
io.use((socket, next) => {
  const token = socket.handshake.auth?.token;

  if (!token) {
    return next(new Error('Authentication error: token missing'));
  }

  jwt.verify(token, config.jwtSecret, (err, user) => {
    if (err) {
      return next(new Error('Authentication error: invalid token'));
    }

    socket.userId = user.id;
    socket.userRole = user.role;

    next();
  });
});

// Подключение пользователя
io.on('connection', (socket) => {
  logger.info(`User connected ${socket.userId}`);

  // Присоединение к комнате диалога
  socket.on('join-conversation', (conversationId) => {
    const room = `conversation:${conversationId}`;
    socket.join(room);

    logger.info(`User ${socket.userId} joined conversation ${conversationId}`);
  });

  // Выход из комнаты
  socket.on('leave-conversation', (conversationId) => {
    const room = `conversation:${conversationId}`;
    socket.leave(room);

    logger.info(`User ${socket.userId} left conversation ${conversationId}`);
  });

  // Отправка сообщения
  socket.on('send-message', async (data) => {
    try {
      const { conversationId, content, type = 'text', mediaUrl } = data;

      const messageService = await import('./services/message.service.js');

      const message = await messageService.sendMessage(
        socket.userId,
        conversationId,
        content,
        type,
        mediaUrl
      );

      const room = `conversation:${conversationId}`;

      io.to(room).emit('new-message', message);

    } catch (error) {
      logger.error('Ошибка при отправке сообщения через socket', error);
      socket.emit('error', 'Не удалось отправить сообщение');
    }
  });

  // Отключение пользователя
  socket.on('disconnect', () => {
    logger.info(`User disconnected ${socket.userId}`);
  });
});

// Обработка необработанных ошибок Promise
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Rejection', err);
});

// Ежедневная задача обновления рекомендаций
cron.schedule('0 3 * * *', async () => {
  logger.info('Запуск ежедневного обновления рекомендаций');

  try {
    await updateSimilarity();
    logger.info('Обновление выполнено успешно');
  } catch (error) {
    logger.error('Ошибка при плановом обновлении', error);
  }
});

// Запуск сервера
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
});
