import express from 'express'
import urlRoutes from './routes/urlRoutes.js'
import { limiter } from './middleware/rateLimiter.js';
import { client } from './services/redisService.js';
import path from 'path'


const app = express();
app.use(express.json());

// Health endpoints (before rate limiter and API routes)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.get('/ready', async (req, res) => {
  try {
    if (!client.isReady) throw new Error('redis not ready');
    await client.ping();
    res.status(200).json({ status: 'ready' });
  } catch {
    res.status(503).json({ status: 'unavailable' });
  }
});
// app.use(express.static(path.resolve('public')));
app.use(limiter);
app.use('/api', urlRoutes);

export default app