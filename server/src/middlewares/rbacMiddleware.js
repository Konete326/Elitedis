import { AppError } from './errorMiddleware.js';

const FULL_ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);

/**
 * Restricts route access to users matching one of the allowed primary roles.
 * SUPER_ADMIN always has platform-wide authorization.
 */
export function requireRole(...roles) {
  const allowed = new Set(roles.flat());

  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
    }

    if (req.user.primaryRole === 'SUPER_ADMIN') {
      return next();
    }

    if (!allowed.has(req.user.primaryRole)) {
      return next(
        new AppError(
          'You do not have role permission to perform this action.',
          403,
          'FORBIDDEN_ROLE',
          { requiredRoles: [...allowed], currentRole: req.user.primaryRole }
        )
      );
    }

    return next();
  };
}

/**
 * Restricts access based on granular HRM workParts privileges (Accept / Non Accept).
 * SUPER_ADMIN and ADMIN automatically pass work-part guards.
 */
export function requireWorkPart(workPartKey) {
  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
    }

    if (FULL_ADMIN_ROLES.has(req.user.primaryRole)) {
      return next();
    }

    const hasPrivilege = Boolean(req.user.workParts && req.user.workParts[workPartKey] === true);
    if (!hasPrivilege) {
      return next(
        new AppError(
          `Work permission "${workPartKey}" is disabled for your account.`,
          403,
          'FORBIDDEN_WORK_PART',
          { requiredWorkPart: workPartKey }
        )
      );
    }

    return next();
  };
}

/**
 * Allows access when the user satisfies ANY listed primaryRole OR ANY listed workPartKey.
 */
export function requireRoleOrWorkPart(roles = [], workPartKeys = []) {
  const allowedRoles = new Set(roles);
  const allowedParts = Array.isArray(workPartKeys) ? workPartKeys : [workPartKeys];

  return (req, _res, next) => {
    if (!req.user) {
      return next(new AppError('Authentication required.', 401, 'UNAUTHORIZED'));
    }

    if (req.user.primaryRole === 'SUPER_ADMIN' || allowedRoles.has(req.user.primaryRole)) {
      return next();
    }

    const hasPart = allowedParts.some((key) => Boolean(req.user.workParts?.[key]));
    if (hasPart) {
      return next();
    }

    return next(new AppError('Access denied for your assigned role or work permissions.', 403, 'FORBIDDEN'));
  };
}

/**
 * Enforces strict SUPER_ADMIN vs ADMIN isolation:
 * Non-SUPER_ADMIN users may never create, edit, assign workParts, or delete a SUPER_ADMIN account.
 */
export function assertNotTargetingSuperAdmin(actorUser, targetRoleOrUser) {
  const actorRole = actorUser?.primaryRole;
  const targetRole = typeof targetRoleOrUser === 'string' ? targetRoleOrUser : targetRoleOrUser?.primaryRole;
  if (actorRole !== 'SUPER_ADMIN' && targetRole === 'SUPER_ADMIN') {
    throw new AppError(
      'Forbidden: only a Super Admin can view or modify a Super Admin account.',
      403,
      'FORBIDDEN_SUPER_ADMIN_MUTATION'
    );
  }
}

/**
 * Returns true if the authenticated user is allowed to view purchase rates,
 * batch acquisition costs, stock cost valuations, or profit margins.
 */
export function canViewPurchasePrice(user) {
  return Boolean(
    user && (FULL_ADMIN_ROLES.has(user.primaryRole) || user.permissions?.purchasePriceVisibility === true)
  );
}

/**
 * Strips purchase rates and cost margins from a Product document when the user lacks purchase price visibility.
 */
export function stripProductPurchaseRates(doc, user) {
  if (!doc || typeof doc !== 'object' || doc._bsontype === 'ObjectId' || doc instanceof Date) {
    return doc;
  }
  if (canViewPurchasePrice(user)) {
    return doc;
  }

  const clone = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  if (clone.baseUnit && typeof clone.baseUnit === 'object') {
    const baseUnit = { ...clone.baseUnit };
    delete baseUnit.traderPurchaseRate;
    clone.baseUnit = baseUnit;
  }
  if (Array.isArray(clone.packingUnits)) {
    clone.packingUnits = clone.packingUnits.map((pack) => {
      if (!pack || typeof pack !== 'object') return pack;
      const nextPack = { ...pack };
      delete nextPack.traderPurchaseRate;
      return nextPack;
    });
  }
  if (clone.defaultRules && typeof clone.defaultRules === 'object') {
    const rules = { ...clone.defaultRules };
    delete rules.retailProfitMarginPkr;
    delete rules.wholesaleMarginPkr;
    clone.defaultRules = rules;
  }
  return clone;
}

/**
 * Strips purchase rates and stock cost valuation from a StockBatch document (and nested productId)
 * when the user lacks purchase price visibility.
 */
export function stripBatchPurchaseRates(doc, user) {
  if (!doc || typeof doc !== 'object' || doc._bsontype === 'ObjectId' || doc instanceof Date) {
    return doc;
  }
  if (canViewPurchasePrice(user)) {
    return doc;
  }

  const clone = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  delete clone.purchaseRatePerBase;
  delete clone.purchaseRatePerPack;
  delete clone.totalStockValuePkr;

  if (clone.productId && typeof clone.productId === 'object' && clone.productId._bsontype !== 'ObjectId') {
    clone.productId = stripProductPurchaseRates(clone.productId, user);
  }
  return clone;
}

/**
 * Restores hidden purchase rates and margins on Product update payloads when the actor lacks purchasePriceVisibility.
 */
export function preserveHiddenProductRates(payload, existing, user) {
  if (!payload || !existing || canViewPurchasePrice(user)) return payload;
  if (payload.baseUnit && existing.baseUnit) {
    payload.baseUnit.traderPurchaseRate = existing.baseUnit.traderPurchaseRate ?? 0;
  }
  if (Array.isArray(payload.packingUnits)) {
    payload.packingUnits = payload.packingUnits.map((pack, idx) => {
      const match = pack?._id
        ? existing.packingUnits?.find((ep) => String(ep._id) === String(pack._id))
        : existing.packingUnits?.[idx];
      return { ...pack, traderPurchaseRate: match?.traderPurchaseRate ?? 0 };
    });
  }
  if (payload.defaultRules && existing.defaultRules) {
    payload.defaultRules.retailProfitMarginPkr = existing.defaultRules.retailProfitMarginPkr ?? 0;
    payload.defaultRules.wholesaleMarginPkr = existing.defaultRules.wholesaleMarginPkr ?? 0;
  }
  return payload;
}

export default {
  requireRole,
  requireWorkPart,
  requireRoleOrWorkPart,
  requireAny: requireRoleOrWorkPart,
  assertNotTargetingSuperAdmin,
  canViewPurchasePrice,
  stripProductPurchaseRates,
  stripBatchPurchaseRates,
  preserveHiddenProductRates,
};
