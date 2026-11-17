import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import mongoSanitize from 'express-mongo-sanitize';

import { env } from './config/env.js';
import { connectDB, disconnectDB, getDbStatus } from './config/db.js';
import { closeAllTenantConnections } from './config/tenantDb.js';
import { seedSuperAdmin } from './config/seedSuperAdmin.js';
import apiRouter from './routes/index.js';
import { notFoundHandler, globalErrorHandler } from './middlewares/errorMiddleware.js';

const app = express();

app.set('trust proxy', 1);

app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || env.CLIENT_ORIGINS.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin ${origin} is not allowed by CORS policy.`));
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));
app.use(cookieParser());

// Express 4/5 safe NoSQL injection sanitization
app.use((req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    mongoSanitize.sanitize(req.body);
  }
  if (req.params && typeof req.params === 'object') {
    mongoSanitize.sanitize(req.params);
  }
  if (req.query && typeof req.query === 'object') {
    mongoSanitize.sanitize(req.query);
  }
  next();
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many authentication requests. Try again shortly.' },
});

// ── Health check / root ──────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.json({
    success: true,
    message: 'ELITE DIST ERP API is running 🚀',
    version: 'v1',
    env: env.NODE_ENV,
    uptime: `${Math.floor(process.uptime())}s`,
    db: getDbStatus(),
  });
});

app.get('/health', (_req, res) => {
  const db = getDbStatus();
  res.status(db.connected ? 200 : 503).json({
    success: db.connected,
    status: db.connected ? 'healthy' : 'degraded',
    db,
    uptime: `${Math.floor(process.uptime())}s`,
  });
});

app.use('/api/v1/auth', authLimiter);
app.use('/api/v1', apiRouter);

app.use(notFoundHandler);
app.use(globalErrorHandler);

let httpServer = null;

/**
 * Connects to MongoDB Atlas, idempotently bootstraps Super Admin, and starts Express server.
 */
export async function startServer() {
  await connectDB({ throwOnError: env.IS_PRODUCTION });

  if (getDbStatus().connected) {
    await seedSuperAdmin();
  } else {
    console.warn('[BOOT] Starting HTTP server without active MongoDB connection (development mode).');
  }

  httpServer = app.listen(env.PORT, () => {
    console.info(`[SERVER] ELITE DIST API listening on port ${env.PORT} (${env.NODE_ENV})`);
  });

  const shutdown = async (signal) => {
    console.info(`[SERVER] Received ${signal}, shutting down gracefully...`);
    if (httpServer) {
      await new Promise((resolve) => httpServer.close(resolve));
    }
    await closeAllTenantConnections();
    await disconnectDB();
    process.exit(0);
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  return httpServer;
}

const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer().catch((err) => {
    console.error('[BOOT FATAL]', err);
    process.exit(1);
  });
}

export { app };
export default app;
