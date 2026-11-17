import { AsyncLocalStorage } from 'node:async_hooks';
import mongoose from 'mongoose';
import { AppError } from '../middlewares/errorMiddleware.js';

const tenantStorage = new AsyncLocalStorage();
const connectionCache = new Map();
const pendingConnections = new Map();

const CONTROL_PLANE_MODELS = new Set(['Distributor']);

/**
 * Masks embedded credentials inside a MongoDB URI before logging or returning to clients.
 */
export function maskMongoUri(uri = '') {
  if (!uri || typeof uri !== 'string') return '';
  return uri.replace(/(mongodb(?:\+srv)?:\/\/)([^:@/]+):([^@/]+)@/i, '$1***:***@');
}

/**
 * Validates MongoDB URI protocol format.
 */
export function isValidMongoUri(uri = '') {
  return typeof uri === 'string' && /^mongodb(\+srv)?:\/\/.+/i.test(uri.trim());
}

/**
 * Registers all Mongoose model schemas on an isolated tenant connection so populate() works seamlessly.
 */
async function ensureTenantSchemas(conn) {
  const modelsMod = await import('../models/index.js');
  for (const [name, defaultModel] of Object.entries(modelsMod)) {
    if (name === 'default' || CONTROL_PLANE_MODELS.has(name)) continue;
    if (!defaultModel?.schema || !defaultModel?.collection?.name) continue;
    if (!conn.models[name]) {
      conn.model(name, defaultModel.schema, defaultModel.collection.name);
    }
  }
}

/**
 * Tests connectivity to a custom MongoDB Atlas URI with a 5-second timeout and pings admin.
 */
export async function testMongoUri(uri) {
  const trimmed = String(uri || '').trim();
  if (!isValidMongoUri(trimmed)) {
    throw new AppError('Invalid MongoDB URI. Must start with mongodb:// or mongodb+srv://', 400, 'INVALID_MONGO_URI');
  }

  const startedAt = Date.now();
  let testConn = null;
  try {
    testConn = await mongoose
      .createConnection(trimmed, {
        maxPoolSize: 2,
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      })
      .asPromise();

    await testConn.db.admin().ping();
    return {
      ok: true,
      databaseName: testConn.name || testConn.db.databaseName,
      latencyMs: Date.now() - startedAt,
      maskedUri: maskMongoUri(trimmed),
    };
  } catch (err) {
    throw new AppError(`MongoDB connection test failed: ${err.message}`, 400, 'MONGO_URI_CONNECTION_FAILED');
  } finally {
    if (testConn) {
      await testConn.close().catch(() => {});
    }
  }
}

/**
 * Returns a cached Mongoose connection pool for a tenant's custom mongodbUri.
 */
export async function getTenantConnection(uri) {
  const trimmed = String(uri || '').trim();
  if (!trimmed) return null;

  const cached = connectionCache.get(trimmed);
  if (cached && cached.readyState === 1) {
    return cached;
  }

  if (pendingConnections.has(trimmed)) {
    return pendingConnections.get(trimmed);
  }

  const connectPromise = mongoose
    .createConnection(trimmed, {
      maxPoolSize: 10,
      minPoolSize: 1,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    })
    .asPromise()
    .then(async (conn) => {
      await ensureTenantSchemas(conn);
      conn.on('disconnected', () => {
        connectionCache.delete(trimmed);
      });
      connectionCache.set(trimmed, conn);
      pendingConnections.delete(trimmed);
      return conn;
    })
    .catch((err) => {
      pendingConnections.delete(trimmed);
      throw new AppError(`Failed to connect to distributor MongoDB: ${err.message}`, 503, 'TENANT_DB_UNAVAILABLE');
    });

  pendingConnections.set(trimmed, connectPromise);
  return connectPromise;
}

/**
 * Runs a callback inside an AsyncLocalStorage tenant database context.
 */
export function runWithTenantContext(context, fn) {
  return tenantStorage.run(context, fn);
}

/**
 * Returns the active request's tenant context ({ distributorId, mongodbUri, connection }).
 */
export function getCurrentTenantContext() {
  return tenantStorage.getStore() || null;
}

/**
 * Resolves the active Mongoose Model bound to the current tenant's connection (or defaultModel).
 */
export function getTenantModel(modelName, defaultModel) {
  if (CONTROL_PLANE_MODELS.has(modelName)) {
    return defaultModel;
  }
  const ctx = tenantStorage.getStore();
  const conn = ctx?.connection;
  if (!conn) return defaultModel;
  if (conn.models[modelName]) return conn.models[modelName];
  if (defaultModel?.schema && defaultModel?.collection?.name) {
    return conn.model(modelName, defaultModel.schema, defaultModel.collection.name);
  }
  return defaultModel;
}

/**
 * Resolves a dictionary of default models to their tenant-scoped counterparts.
 */
export function getTenantModels(modelMap) {
  const resolved = {};
  for (const [name, defaultModel] of Object.entries(modelMap)) {
    resolved[name] = getTenantModel(name, defaultModel);
  }
  return resolved;
}

/**
 * Returns the active MongoDB Db instance (tenant-isolated if custom URI, else Control Plane).
 */
export function getTenantDb() {
  const ctx = tenantStorage.getStore();
  return ctx?.connection?.db || mongoose.connection.db;
}

/**
 * Returns the active Mongoose Connection for transactions.
 */
export function getActiveConnection() {
  const ctx = tenantStorage.getStore();
  return ctx?.connection || mongoose.connection;
}

/**
 * Closes all cached custom tenant connection pools on graceful shutdown.
 */
export async function closeAllTenantConnections() {
  const conns = [...connectionCache.values()];
  connectionCache.clear();
  await Promise.allSettled(conns.map((c) => c.close()));
}

export default {
  maskMongoUri,
  isValidMongoUri,
  testMongoUri,
  getTenantConnection,
  runWithTenantContext,
  getCurrentTenantContext,
  getTenantModel,
  getTenantModels,
  getTenantDb,
  getActiveConnection,
  closeAllTenantConnections,
};
