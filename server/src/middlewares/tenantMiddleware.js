import { AppError } from './errorMiddleware.js';
import { Distributor } from '../models/Distributor.model.js';
import { getTenantConnection, runWithTenantContext } from '../config/tenantDb.js';

/**
 * Escapes special RegExp characters to keep search filters ReDoS-safe.
 */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Enforces strict multi-distributor tenant isolation and routes requests to the
 * distributor's custom MongoDB Atlas connection pool (when configured) via AsyncLocalStorage.
 */
export async function enforceTenant(req, _res, next) {
  try {
    if (!req.user || !req.user.distributorId) {
      return next(new AppError('Distributor tenant context is missing from session.', 403, 'TENANT_CONTEXT_MISSING'));
    }

    const distributorId = String(req.user.distributorId).trim();
    req.distributorId = distributorId;

    if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      if (req.body.distributorId && req.body.distributorId !== distributorId) {
        return next(new AppError('Cross-distributor data access or mutation is prohibited.', 403, 'TENANT_ISOLATION_VIOLATION'));
      }
      req.body.distributorId = distributorId;
    }

    if (req.query?.distributorId && req.query.distributorId !== distributorId) {
      return next(new AppError('Cross-distributor query access is prohibited.', 403, 'TENANT_ISOLATION_VIOLATION'));
    }

    const distributor = await Distributor.findOne({ distributorId })
      .select('+mongodbUri status')
      .lean();

    if (distributor?.status === 'SUSPENDED' && req.user.primaryRole !== 'SUPER_ADMIN') {
      return next(new AppError('Your distributor account is currently suspended. Contact platform support.', 403, 'DISTRIBUTOR_SUSPENDED'));
    }

    const customUri = distributor?.mongodbUri ? String(distributor.mongodbUri).trim() : '';
    const connection = customUri ? await getTenantConnection(customUri) : null;

    return runWithTenantContext({ distributorId, mongodbUri: customUri, connection }, () => next());
  } catch (err) {
    return next(err);
  }
}

/**
 * Parses standardized server-side pagination, search, and sorting query parameters.
 */
export function buildPaginationQuery(req, options = {}) {
  const {
    defaultLimit = 10,
    maxLimit = 100,
    defaultSortBy = 'createdAt',
    defaultSortOrder = 'desc',
    allowedSortFields = null,
  } = options;

  const rawPage = Number.parseInt(req.query?.page, 10);
  const rawLimit = Number.parseInt(req.query?.limit, 10);

  const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, maxLimit) : defaultLimit;
  const skip = (page - 1) * limit;

  const rawSearch = typeof req.query?.search === 'string' ? req.query.search.trim() : '';
  const searchRegex = rawSearch ? new RegExp(escapeRegex(rawSearch), 'i') : null;

  const requestedSortBy = typeof req.query?.sortBy === 'string' ? req.query.sortBy.trim() : '';
  let sortBy = defaultSortBy;
  if (requestedSortBy && /^[a-zA-Z0-9_.]+$/.test(requestedSortBy)) {
    if (!allowedSortFields || allowedSortFields.includes(requestedSortBy)) {
      sortBy = requestedSortBy;
    }
  }

  const rawOrder = typeof req.query?.sortOrder === 'string' ? req.query.sortOrder.toLowerCase() : defaultSortOrder;
  const sortOrder = rawOrder === 'asc' || rawOrder === '1' ? 1 : -1;
  const sort = { [sortBy]: sortOrder };

  const buildPaginationMeta = (totalRecords) => {
    const total = Math.max(0, Number(totalRecords) || 0);
    const totalPages = Math.max(1, Math.ceil(total / limit));
    return {
      totalRecords: total,
      currentPage: page,
      totalPages,
      pageSize: limit,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    };
  };

  return {
    page,
    limit,
    skip,
    sort,
    sortBy,
    sortOrder,
    search: rawSearch,
    searchRegex,
    buildPaginationMeta,
  };
}

/**
 * Builds a tenant-scoped MongoDB query filter with optional multi-field search.
 */
export function buildScopedFilter(req, extra = {}, searchFields = [], searchRegex = null) {
  const filter = {
    distributorId: req.distributorId || req.user?.distributorId,
    ...extra,
  };

  if (searchRegex && searchFields.length > 0) {
    filter.$or = searchFields.map((field) => ({ [field]: searchRegex }));
  }

  return filter;
}

export default { enforceTenant, buildPaginationQuery, buildScopedFilter, escapeRegex };
