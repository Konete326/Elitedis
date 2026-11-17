import bcrypt from 'bcryptjs';
import { env } from '../config/env.js';
import { Distributor, User } from '../models/index.js';
import { destroyImage } from '../config/cloudinary.js';
import { getTenantConnection, maskMongoUri, testMongoUri } from '../config/tenantDb.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, escapeRegex } from '../middlewares/tenantMiddleware.js';

function sanitizeDistributor(doc, userCount = 0) {
  const obj = typeof doc.toObject === 'function' ? doc.toObject() : { ...doc };
  const rawUri = obj.mongodbUri || '';
  delete obj.mongodbUri;
  return {
    ...obj,
    hasCustomDb: Boolean(rawUri),
    maskedMongodbUri: maskMongoUri(rawUri),
    userCount,
  };
}

function hasFilledBranding(profile = {}) {
  return Boolean(
    profile &&
      (profile.city ||
        profile.fullAddress ||
        profile.ntn ||
        profile.strn ||
        profile.headerNote ||
        profile.footerNote ||
        profile.logo?.url)
  );
}

async function mirrorAdminToCustomDb(mongodbUri, userDoc) {
  if (!mongodbUri) return;
  try {
    const conn = await getTenantConnection(mongodbUri);
    if (!conn) return;
    const TenantUser = conn.models.User || conn.model('User', User.schema, 'users');
    await TenantUser.updateOne({ _id: userDoc._id }, { $set: userDoc.toObject({ transform: false }) }, { upsert: true });
  } catch {
    // Non-fatal if tenant DB is temporarily unreachable during registry creation
  }
}

export const listDistributors = asyncHandler(async (req, res) => {
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const filter = {};
  if (req.query.status) filter.status = req.query.status;
  if (searchRegex) {
    filter.$or = [
      { distributorId: searchRegex },
      { distributorName: searchRegex },
      { ownerName: searchRegex },
      { email: searchRegex },
      { phone: searchRegex },
    ];
  }

  const [distributors, totalRecords, userCounts] = await Promise.all([
    Distributor.find(filter).select('+mongodbUri').sort(sort).skip(skip).limit(limit).lean(),
    Distributor.countDocuments(filter),
    User.aggregate([{ $group: { _id: '$distributorId', count: { $sum: 1 } } }]),
  ]);

  const countMap = new Map(userCounts.map((c) => [c._id, c.count]));
  const data = distributors.map((d) => sanitizeDistributor(d, countMap.get(d.distributorId) || 0));

  res.status(200).json({ success: true, data, pagination: buildPaginationMeta(totalRecords) });
});

export const createDistributor = asyncHandler(async (req, res) => {
  const {
    distributorId: rawCode,
    distributorName,
    ownerName = '',
    email,
    phone = '',
    whatsappNo = '',
    mongodbUri = '',
    businessProfile = {},
    adminPassword,
    password,
    status = 'ACTIVE',
  } = req.body;

  if (!distributorName || !email) {
    throw new AppError('Distributor Name and Admin Email are required.', 400, 'DISTRIBUTOR_FIELDS_REQUIRED');
  }

  const normalizedEmail = String(email).toLowerCase().trim();
  const rawPassword = adminPassword || password;
  if (!rawPassword || String(rawPassword).length < 6) {
    throw new AppError('Admin password (minimum 6 characters) is required.', 400, 'PASSWORD_REQUIRED');
  }

  if (await User.exists({ email: normalizedEmail })) {
    throw new AppError('An account with this Admin email already exists.', 409, 'EMAIL_EXISTS');
  }

  const slug = String(rawCode || distributorName)
    .replace(/[^a-zA-Z0-9-]/g, '')
    .toUpperCase()
    .slice(0, 14);
  const distributorId = rawCode ? slug : `${slug || 'DIST'}-${Date.now().toString().slice(-4)}`;

  if (await Distributor.exists({ distributorId })) {
    throw new AppError(`Distributor code "${distributorId}" already exists.`, 409, 'DISTRIBUTOR_EXISTS');
  }

  const cleanUri = String(mongodbUri || '').trim();
  const profilePayload = {
    companyTitle: businessProfile.companyTitle || distributorName,
    phonePrimary: businessProfile.phonePrimary || phone,
    email: businessProfile.email || normalizedEmail,
    ...businessProfile,
  };
  const onboardingCompleted = Boolean(req.body.onboardingCompleted || hasFilledBranding(businessProfile));

  const createdDist = await Distributor.create({
    distributorId,
    distributorName,
    ownerName: ownerName || distributorName,
    email: normalizedEmail,
    phone,
    whatsappNo,
    mongodbUri: cleanUri,
    businessProfile: profilePayload,
    onboardingCompleted,
    onboardingSkipped: false,
    status,
  });

  const passwordHash = await bcrypt.hash(String(rawPassword), 12);
  const adminUser = await User.create({
    distributorId,
    distributorName,
    profileId: `ADM-${Date.now().toString().slice(-5)}`,
    fullName: ownerName || `${distributorName} Admin`,
    email: normalizedEmail,
    phone: phone || '03000000000',
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
    status: status === 'SUSPENDED' ? 'INACTIVE' : 'ACTIVE',
  });

  if (cleanUri) await mirrorAdminToCustomDb(cleanUri, adminUser);

  const fresh = await Distributor.findById(createdDist._id).select('+mongodbUri').lean();
  res.status(201).json({
    success: true,
    data: { distributor: sanitizeDistributor(fresh, 1), adminUser: adminUser.toJSON() },
  });
});

export const updateDistributor = asyncHandler(async (req, res) => {
  const dist = await Distributor.findById(req.params.id).select('+mongodbUri');
  if (!dist) throw new AppError('Distributor not found.', 404, 'DISTRIBUTOR_NOT_FOUND');

  const oldLogoId = dist.businessProfile?.logo?.publicId;
  const {
    distributorName,
    ownerName,
    email,
    phone,
    whatsappNo,
    mongodbUri,
    clearMongodbUri,
    businessProfile,
    status,
    onboardingCompleted,
  } = req.body;

  if (distributorName !== undefined) dist.distributorName = distributorName;
  if (ownerName !== undefined) dist.ownerName = ownerName;
  if (email !== undefined) dist.email = String(email).toLowerCase().trim();
  if (phone !== undefined) dist.phone = phone;
  if (whatsappNo !== undefined) dist.whatsappNo = whatsappNo;
  if (status !== undefined) dist.status = status;

  if (clearMongodbUri) {
    dist.mongodbUri = '';
  } else if (mongodbUri !== undefined && String(mongodbUri).trim() !== '') {
    dist.mongodbUri = String(mongodbUri).trim();
  }

  if (businessProfile && typeof businessProfile === 'object') {
    const prev = dist.businessProfile?.toObject?.() || dist.businessProfile || {};
    dist.businessProfile = { ...prev, ...businessProfile };
    if (hasFilledBranding(businessProfile)) dist.onboardingCompleted = true;
  }
  if (typeof onboardingCompleted === 'boolean') {
    dist.onboardingCompleted = onboardingCompleted;
  }

  await dist.save();
  const newLogoId = dist.businessProfile?.logo?.publicId;
  if (oldLogoId && newLogoId !== oldLogoId) await destroyImage(oldLogoId).catch(() => {});

  const userCount = await User.countDocuments({ distributorId: dist.distributorId });
  res.status(200).json({ success: true, data: sanitizeDistributor(dist.toObject({ transform: false }), userCount) });
});

export const deleteDistributor = asyncHandler(async (req, res) => {
  const dist = await Distributor.findById(req.params.id);
  if (!dist) throw new AppError('Distributor not found.', 404, 'DISTRIBUTOR_NOT_FOUND');

  const defaultCode = env.DEFAULT_DISTRIBUTOR_CODE.toUpperCase().trim();
  if (dist.distributorId === defaultCode) {
    throw new AppError('Cannot delete the primary platform distributor.', 400, 'CANNOT_DELETE_DEFAULT_DISTRIBUTOR');
  }

  const oldLogoId = dist.businessProfile?.logo?.publicId;
  await User.deleteMany({ distributorId: dist.distributorId });
  await dist.deleteOne();
  if (oldLogoId) await destroyImage(oldLogoId).catch(() => {});

  res.status(200).json({ success: true, message: 'Distributor and associated accounts deleted.' });
});

export const testDistributorMongoUri = asyncHandler(async (req, res) => {
  const { mongodbUri } = req.body;
  const result = await testMongoUri(mongodbUri);
  res.status(200).json({ success: true, data: result });
});

export default {
  listDistributors,
  createDistributor,
  updateDistributor,
  deleteDistributor,
  testDistributorMongoUri,
};
