import bcrypt from 'bcryptjs';
import { env } from './env.js';
import { User } from '../models/User.model.js';

/**
 * Idempotently creates the Super Admin account from server/.env if not present.
 * Never overwrites or duplicates an existing Super Admin account on restarts.
 */
export async function seedSuperAdmin() {
  const normalizedEmail = env.SUPER_ADMIN_EMAIL.toLowerCase().trim();
  const existing = await User.findOne({ email: normalizedEmail }).lean();

  if (existing) {
    console.info(`[SEED] Super Admin already exists (${normalizedEmail})`);
    return existing;
  }

  const passwordHash = await bcrypt.hash(env.SUPER_ADMIN_PASSWORD, 12);

  const created = await User.create({
    distributorId: env.DEFAULT_DISTRIBUTOR_CODE,
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
