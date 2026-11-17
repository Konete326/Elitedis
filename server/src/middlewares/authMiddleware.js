import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { User } from '../models/User.model.js';
import { AppError, asyncHandler } from './errorMiddleware.js';

/**
 * Extracts a Bearer JWT from the Authorization header or accessToken cookie.
 */
export function extractBearerToken(req) {
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }
  if (req.cookies?.accessToken) {
    return String(req.cookies.accessToken).trim();
  }
  return null;
}

/**
 * Verifies the JWT access token, checks active user status, and attaches req.user.
 */
export const protect = asyncHandler(async (req, _res, next) => {
  const token = extractBearerToken(req);
  if (!token) {
    throw new AppError('Authentication required. Please sign in to continue.', 401, 'UNAUTHORIZED');
  }

  let decoded;
  try {
    decoded = jwt.verify(token, env.JWT_ACCESS_SECRET);
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Access token expired. Refresh your session or sign in again.', 401, 'TOKEN_EXPIRED');
    }
    throw new AppError('Invalid authentication token.', 401, 'INVALID_TOKEN');
  }

  const userId = decoded.sub || decoded.userId || decoded.id;
  if (!userId) {
    throw new AppError('Malformed authentication token payload.', 401, 'INVALID_TOKEN');
  }

  const user = await User.findById(userId).select('-passwordHash').lean();
  if (!user) {
    throw new AppError('User account no longer exists.', 401, 'USER_NOT_FOUND');
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError(`Account is ${user.status}. Please contact your administrator.`, 403, 'ACCOUNT_INACTIVE');
  }

  req.user = {
    ...user,
    id: user._id.toString(),
  };
  req.distributorId = user.distributorId;

  next();
});

export default protect;
