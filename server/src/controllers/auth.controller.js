import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { User } from '../models/index.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';

const loginSchema = z.object({
  email: z.string().trim().optional(),
  identifier: z.string().trim().optional(),
  password: z.string().min(1, 'Password is required'),
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2, 'Full name is required'),
  email: z.string().trim().email('Valid email is required'),
  phone: z.string().trim().min(7, 'Phone number is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  distributorName: z.string().trim().min(2).optional(),
  distributorCode: z.string().trim().min(2).optional(),
});

function issueTokens(user) {
  const payload = {
    sub: user._id.toString(),
    distributorId: user.distributorId,
    primaryRole: user.primaryRole,
  };

  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN,
  });

  const refreshToken = jwt.sign({ sub: user._id.toString(), type: 'refresh' }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN,
  });

  return { accessToken, refreshToken };
}

function setRefreshCookie(res, refreshToken) {
  res.cookie('refreshToken', refreshToken, {
    httpOnly: true,
    secure: env.IS_PRODUCTION,
    sameSite: env.IS_PRODUCTION ? 'strict' : 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/api/v1/auth',
  });
}

export const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.parse(req.body);
  const identifier = (parsed.email || parsed.identifier || '').trim();
  const password = parsed.password;
  if (!identifier) {
    throw new AppError('Email or Profile ID is required.', 400, 'IDENTIFIER_REQUIRED');
  }

  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { profileId: identifier.toUpperCase() }],
  });

  if (!user) {
    throw new AppError('Invalid email/profile ID or password.', 401, 'INVALID_CREDENTIALS');
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    throw new AppError('Invalid email/profile ID or password.', 401, 'INVALID_CREDENTIALS');
  }

  if (user.status !== 'ACTIVE') {
    throw new AppError(`Your account is ${user.status}. Please contact your administrator.`, 403, 'ACCOUNT_INACTIVE');
  }

  const { accessToken, refreshToken } = issueTokens(user);
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  user.lastLoginAt = new Date();
  await user.save();

  setRefreshCookie(res, refreshToken);

  res.status(200).json({
    success: true,
    data: {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    },
  });
});

export const register = asyncHandler(async (req, res) => {
  const parsed = registerSchema.parse(req.body);
  const normalizedEmail = parsed.email.toLowerCase().trim();

  const existing = await User.exists({ email: normalizedEmail });
  if (existing) {
    throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
  }

  const slug = (parsed.distributorCode || parsed.distributorName || 'DIST')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8);
  const distributorId = `${slug || 'DIST'}-${Date.now().toString().slice(-4)}`;
  const passwordHash = await bcrypt.hash(parsed.password, 12);

  const user = await User.create({
    distributorId,
    distributorName: parsed.distributorName || `${parsed.fullName} Distribution`,
    profileId: `ADM-${Date.now().toString().slice(-5)}`,
    fullName: parsed.fullName,
    email: normalizedEmail,
    phone: parsed.phone,
    passwordHash,
    primaryRole: 'ADMIN',
    workParts: {
      orderBooker: true,
      warehouseManager: true,
      posStore: true,
      normalInvoice: true,
      advanceInvoice: true,
      salesman: true,
    },
    status: 'ACTIVE',
    lastLoginAt: new Date(),
  });

  const { accessToken, refreshToken } = issueTokens(user);
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();

  setRefreshCookie(res, refreshToken);

  res.status(201).json({
    success: true,
    data: {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const incomingToken = req.body?.refreshToken || req.cookies?.refreshToken;
  if (!incomingToken) {
    throw new AppError('Refresh token is missing.', 401, 'REFRESH_TOKEN_MISSING');
  }

  let decoded;
  try {
    decoded = jwt.verify(incomingToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw new AppError('Invalid or expired refresh token.', 401, 'INVALID_REFRESH_TOKEN');
  }

  const user = await User.findById(decoded.sub);
  if (!user || user.status !== 'ACTIVE' || !user.refreshTokenHash) {
    throw new AppError('Session is no longer active. Please sign in again.', 401, 'SESSION_REVOKED');
  }

  const matches = await bcrypt.compare(incomingToken, user.refreshTokenHash);
  if (!matches) {
    user.refreshTokenHash = null;
    await user.save();
    throw new AppError('Refresh token reuse detected. Please sign in again.', 401, 'TOKEN_REUSE_DETECTED');
  }

  const { accessToken, refreshToken } = issueTokens(user);
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();

  setRefreshCookie(res, refreshToken);

  res.status(200).json({
    success: true,
    data: {
      user: user.toJSON(),
      accessToken,
      refreshToken,
    },
  });
});

export const logout = asyncHandler(async (req, res) => {
  if (req.user?._id) {
    await User.findByIdAndUpdate(req.user._id, { refreshTokenHash: null });
  }
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  res.status(200).json({ success: true, message: 'Signed out successfully.' });
});

export const getMe = asyncHandler(async (req, res) => {
  res.status(200).json({ success: true, data: req.user });
});

export default { login, register, refresh, logout, getMe };
