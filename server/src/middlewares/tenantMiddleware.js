import { AppError } from './errorMiddleware.js';

/**
 * Escapes special RegExp characters to keep search filters ReDoS-safe.
 */
export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Enforces strict multi-distributor tenant isolation on every request.
 * Binds req.distributorId from the authenticated user and blocks cross-tenant overrides.
 */
export function enforceTenant(req, _res, next) {
  if (!req.user || !req.user.distributorId) {
    return next(new AppError('Distributor tenant context is missing from session.', 403, 'TENANT_CONTEXT_MISSING'));
  }

  req.distributorId = String(req.user.distributorId).trim();

  if (req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
    if (req.body.distributorId && req.body.distributorId !== req.distributorId) {
      return next(new AppError('Cross-distributor data access or mutation is prohibited.', 403, 'TENANT_ISOLATION_VIOLATION'));
    }
    req.body.distributorId = req.distributorId;
  }

  if (req.query?.distributorId && req.query.distributorId !== req.distributorId) {
    return next(new AppError('Cross-distributor query access is prohibited.', 403, 'TENANT_ISOLATION_VIOLATION'));
  }

  return next();
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
