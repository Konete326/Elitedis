import mongoose from 'mongoose';
import { env } from './env.js';

let connectionPromise = null;
let lastError = null;
let listenersAttached = false;

const READY_STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

function attachConnectionListeners() {
  if (listenersAttached) return;
  listenersAttached = true;

  mongoose.connection.on('connected', () => {
    lastError = null;
    console.info(`[DB] Connected to MongoDB (${mongoose.connection.name || 'elite_dist_erp'})`);
  });

  mongoose.connection.on('error', (error) => {
    lastError = error.message;
    console.error(`[DB] Mongoose connection error: ${error.message}`);
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB disconnected');
  });
}

/**
 * Establishes or returns the singleton Mongoose connection to MongoDB Atlas.
 */
export async function connectDB({ throwOnError = true } = {}) {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  attachConnectionListeners();

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(env.MONGODB_URI, {
        maxPoolSize: 20,
        minPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        socketTimeoutMS: 45000,
        autoIndex: !env.IS_PRODUCTION,
      })
      .then((m) => m.connection)
      .catch((error) => {
        lastError = error.message;
        connectionPromise = null;
        if (throwOnError) {
          throw error;
        }
        return null;
      });
  }

  return connectionPromise;
}

/**
 * Returns the live connection readiness snapshot for health checks.
 */
export function getDbStatus() {
  const readyState = mongoose.connection.readyState;
  return {
    connected: readyState === 1,
    readyState,
    state: READY_STATE_LABELS[readyState] || 'unknown',
    host: mongoose.connection.host || null,
    database: mongoose.connection.name || null,
    lastError,
  };
}

/**
 * Gracefully closes the Mongoose connection during server shutdown.
 */
export async function disconnectDB() {
  connectionPromise = null;
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

export default connectDB;
