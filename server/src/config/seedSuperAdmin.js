import bcrypt from 'bcryptjs';
import { env } from './env.js';
import { User } from '../models/User.model.js';
import { Distributor } from '../models/Distributor.model.js';

/**
 * Idempotently creates the Super Admin account and default Distributor registry from server/.env.
 */
export async function seedSuperAdmin() {
  const normalizedEmail = env.SUPER_ADMIN_EMAIL.toLowerCase().trim();
  const distCode = env.DEFAULT_DISTRIBUTOR_CODE.toUpperCase().trim();

  const existingDist = await Distributor.findOne({ distributorId: distCode }).lean();
  if (!existingDist) {
    await Distributor.create({
      distributorId: distCode,
      distributorName: env.DEFAULT_DISTRIBUTOR_NAME,
      ownerName: env.SUPER_ADMIN_NAME,
      email: normalizedEmail,
      phone: env.SUPER_ADMIN_PHONE,
      businessProfile: {
        companyTitle: env.DEFAULT_DISTRIBUTOR_NAME,
        phonePrimary: env.SUPER_ADMIN_PHONE,
        email: normalizedEmail,
      },
      onboardingCompleted: true,
      onboardingSkipped: false,
      status: 'ACTIVE',
    });
    console.info(`[SEED] Default Distributor registered (${distCode})`);
  }

  const existing = await User.findOne({ email: normalizedEmail }).lean();
  if (existing) {
    console.info(`[SEED] Super Admin already exists (${normalizedEmail})`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, 12);
  const created = await User.create({
    distributorId: distCode,
    distributorName: env.DEFAULT_DISTRIBUTOR_NAME,
    profileId: 'SUPER-001',
    fullName: env.SUPER_ADMIN_NAME,
    email: normalizedEmail,
    phone: env.SUPER_ADMIN_PHONE,
    passwordHash,
    primaryRole: 'SUPER_ADMIN',
    workParts: {
      orderBooker: true,
      warehouseManager: true,
      posStore: true,
      normalInvoice: true,
      advanceInvoice: true,
      salesman: true,
    },
    status: 'ACTIVE',
  });

  console.info(`[SEED] Super Admin bootstrapped (${created.email} / ${created.distributorId})`);
  return created.toObject();
}

export default seedSuperAdmin;
