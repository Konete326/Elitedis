import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { env } from '../config/env.js';
import { destroyImage } from '../config/cloudinary.js';
import { getTenantModel } from '../config/tenantDb.js';
import { User, Distributor, PrintTemplate } from '../models/index.js';
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
  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, { expiresIn: env.JWT_ACCESS_EXPIRES_IN });
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

function formatAgencyProfile(doc) {
  if (!doc) return null;
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const hasCustomDb = Boolean(obj.mongodbUri);
  delete obj.mongodbUri;
  return { ...obj, hasCustomDb };
}

async function ensureAgencyProfile(distributorId, fallbackUser = null) {
  let dist = await Distributor.findOne({ distributorId }).select('+mongodbUri');
  if (!dist) {
    dist = await Distributor.create({
      distributorId,
      distributorName: fallbackUser?.distributorName || distributorId,
      ownerName: fallbackUser?.fullName || '',
      email: fallbackUser?.email || '',
      phone: fallbackUser?.phone || '',
      businessProfile: {
        companyTitle: fallbackUser?.distributorName || distributorId,
        phonePrimary: fallbackUser?.phone || '',
        email: fallbackUser?.email || '',
      },
      onboardingCompleted: false,
      onboardingSkipped: false,
      status: 'ACTIVE',
    });
  }
  return formatAgencyProfile(dist);
}

export const login = asyncHandler(async (req, res) => {
  const parsed = loginSchema.parse(req.body);
  const identifier = (parsed.email || parsed.identifier || '').trim();
  if (!identifier) throw new AppError('Email or Profile ID is required.', 400, 'IDENTIFIER_REQUIRED');

  const user = await User.findOne({
    $or: [{ email: identifier.toLowerCase() }, { profileId: identifier.toUpperCase() }],
  });
  if (!user || !(await bcrypt.compare(parsed.password, user.passwordHash))) {
    throw new AppError('Invalid email/profile ID or password.', 401, 'INVALID_CREDENTIALS');
  }
  if (user.status !== 'ACTIVE') {
    throw new AppError(`Your account is ${user.status}. Please contact your administrator.`, 403, 'ACCOUNT_INACTIVE');
  }

  const agencyProfile = await ensureAgencyProfile(user.distributorId, user);
  if (agencyProfile?.status === 'SUSPENDED' && user.primaryRole !== 'SUPER_ADMIN') {
    throw new AppError('Your distributor account is currently suspended.', 403, 'DISTRIBUTOR_SUSPENDED');
  }

  const { accessToken, refreshToken } = issueTokens(user);
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  user.lastLoginAt = new Date();
  await user.save();
  setRefreshCookie(res, refreshToken);

  res.status(200).json({
    success: true,
    data: { user: user.toJSON(), agencyProfile, accessToken, refreshToken },
  });
});

export const register = asyncHandler(async (req, res) => {
  const parsed = registerSchema.parse(req.body);
  const normalizedEmail = parsed.email.toLowerCase().trim();
  if (await User.exists({ email: normalizedEmail })) {
    throw new AppError('An account with this email already exists.', 409, 'EMAIL_EXISTS');
  }

  const slug = (parsed.distributorCode || parsed.distributorName || 'DIST')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase()
    .slice(0, 8);
  const distributorId = `${slug || 'DIST'}-${Date.now().toString().slice(-4)}`;
  const distributorName = parsed.distributorName || `${parsed.fullName} Distribution`;
  const passwordHash = await bcrypt.hash(parsed.password, 12);

  await Distributor.create({
    distributorId,
    distributorName,
    ownerName: parsed.fullName,
    email: normalizedEmail,
    phone: parsed.phone,
    businessProfile: {
      companyTitle: distributorName,
      phonePrimary: parsed.phone,
      email: normalizedEmail,
    },
    onboardingCompleted: false,
    onboardingSkipped: false,
    status: 'ACTIVE',
  });

  const user = await User.create({
    distributorId,
    distributorName,
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

  const agencyProfile = await ensureAgencyProfile(distributorId, user);
  const { accessToken, refreshToken } = issueTokens(user);
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();
  setRefreshCookie(res, refreshToken);

  res.status(201).json({
    success: true,
    data: { user: user.toJSON(), agencyProfile, accessToken, refreshToken },
  });
});

export const refresh = asyncHandler(async (req, res) => {
  const incomingToken = req.body?.refreshToken || req.cookies?.refreshToken;
  if (!incomingToken) throw new AppError('Refresh token is missing.', 401, 'REFRESH_TOKEN_MISSING');

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
  if (!(await bcrypt.compare(incomingToken, user.refreshTokenHash))) {
    user.refreshTokenHash = null;
    await user.save();
    throw new AppError('Refresh token reuse detected. Please sign in again.', 401, 'TOKEN_REUSE_DETECTED');
  }

  const agencyProfile = await ensureAgencyProfile(user.distributorId, user);
  const { accessToken, refreshToken } = issueTokens(user);
  user.refreshTokenHash = await bcrypt.hash(refreshToken, 10);
  await user.save();
  setRefreshCookie(res, refreshToken);

  res.status(200).json({ success: true, data: { user: user.toJSON(), agencyProfile, accessToken, refreshToken } });
});

export const logout = asyncHandler(async (req, res) => {
  if (req.user?._id) await User.findByIdAndUpdate(req.user._id, { refreshTokenHash: null });
  res.clearCookie('refreshToken', { path: '/api/v1/auth' });
  res.status(200).json({ success: true, message: 'Signed out successfully.' });
});

export const getMe = asyncHandler(async (req, res) => {
  const agencyProfile = await ensureAgencyProfile(req.user.distributorId, req.user);
  res.status(200).json({ success: true, data: { ...req.user, agencyProfile } });
});

export const getAgencyProfile = asyncHandler(async (req, res) => {
  const profile = await ensureAgencyProfile(req.distributorId, req.user);
  res.status(200).json({ success: true, data: profile });
});

export const updateAgencyProfile = asyncHandler(async (req, res) => {
  await ensureAgencyProfile(req.distributorId, req.user);
  const dist = await Distributor.findOne({ distributorId: req.distributorId }).select('+mongodbUri');
  const oldLogoId = dist.businessProfile?.logo?.publicId;

  const incoming = req.body.businessProfile || req.body;
  const prevProfile = dist.businessProfile?.toObject?.() || dist.businessProfile || {};
  const mergedProfile = { ...prevProfile };
  const allowedKeys = [
    'companyTitle', 'tagline', 'logo', 'phonePrimary', 'phoneSecondary', 'email', 'website',
    'ntn', 'strn', 'city', 'area', 'fullAddress', 'headerNote', 'footerNote', 'urduHeaderTitle',
    'showLogo', 'showUrduLabels',
  ];
  for (const key of allowedKeys) {
    if (incoming[key] !== undefined) mergedProfile[key] = incoming[key];
  }

  if (req.body.distributorName) dist.distributorName = req.body.distributorName;
  else if (mergedProfile.companyTitle) dist.distributorName = mergedProfile.companyTitle;

  dist.businessProfile = mergedProfile;
  dist.onboardingCompleted = true;
  dist.onboardingSkipped = false;
  await dist.save();

  const newLogoId = dist.businessProfile?.logo?.publicId;
  if (oldLogoId && newLogoId !== oldLogoId) await destroyImage(oldLogoId).catch(() => {});

  // Sync branding into default PrintTemplate for this tenant
  const PrintTemplateM = getTenantModel('PrintTemplate', PrintTemplate);
  const existingTpl = await PrintTemplateM.findOne({ distributorId: req.distributorId, isDefault: true });
  if (existingTpl) {
    existingTpl.headerConfig.companyTitle = mergedProfile.companyTitle || dist.distributorName;
    existingTpl.headerConfig.showLogo = mergedProfile.showLogo !== false;
    existingTpl.headerConfig.subjectLine = mergedProfile.headerNote || existingTpl.headerConfig.subjectLine;
    existingTpl.footerConfig.footerNoteLine = mergedProfile.footerNote || existingTpl.footerConfig.footerNoteLine;
    existingTpl.showUrduLabels = Boolean(mergedProfile.showUrduLabels);
    await existingTpl.save();
  } else {
    await PrintTemplateM.create({
      distributorId: req.distributorId,
      templateCode: 'TPL-DEFAULT',
      templateName: `${mergedProfile.companyTitle || dist.distributorName} Standard Invoice`,
      documentType: 'NORMAL_INVOICE',
      headerConfig: {
        showLogo: mergedProfile.showLogo !== false,
        showCompanyName: true,
        companyTitle: mergedProfile.companyTitle || dist.distributorName,
        showAddress: true,
        subjectLine: mergedProfile.headerNote || '',
      },
      footerConfig: { footerNoteLine: mergedProfile.footerNote || '' },
      showUrduLabels: Boolean(mergedProfile.showUrduLabels),
      isDefault: true,
    });
  }

  res.status(200).json({ success: true, data: formatAgencyProfile(dist) });
});

export const skipAgencyOnboarding = asyncHandler(async (req, res) => {
  await ensureAgencyProfile(req.distributorId, req.user);
  const dist = await Distributor.findOneAndUpdate(
    { distributorId: req.distributorId },
    { $set: { onboardingSkipped: true } },
    { new: true }
  ).select('+mongodbUri');
  res.status(200).json({ success: true, data: formatAgencyProfile(dist) });
});

export default {
  login,
  register,
  refresh,
  logout,
  getMe,
  getAgencyProfile,
  updateAgencyProfile,
  skipAgencyOnboarding,
};
