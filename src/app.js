import express from 'express'
import cors from 'cors'
import { config } from './config/env.js'
import { apiLimiter } from './middleware/rateLimit.middleware.js'
import { errorHandler } from './middleware/error.middleware.js'
import authRoutes from './routes/auth.routes.js'
import userRoutes from './routes/user.routes.js'
import postRoutes from './routes/post.routes.js'
import paymentRoutes from './routes/payment.routes.js'
import aiRoutes from './routes/ai.routes.js'
import notificationRoutes from './routes/notification.routes.js'
import balanceRoutes from './routes/balance.routes.js'
import messageRoutes from './routes/message.routes.js'

const app = express()

// Разрешаем несколько источников (для разработки и продакшена)
const allowedOrigins = [
  config.frontendUrl,
  'http://localhost:5173',
  'http://localhost:3000'
]
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true
}))

app.use(express.json())
app.use(apiLimiter)

// Подключаем роуты
app.use('/api/auth', authRoutes)
app.use('/api/users', userRoutes)
app.use('/api/posts', postRoutes)
app.use('/api/payments', paymentRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/notifications', notificationRoutes)
app.use('/api/balance', balanceRoutes)
app.use('/api/messages', messageRoutes)

app.get('/health', (req, res) => res.send('OK'))

app.use(errorHandler)

export default app