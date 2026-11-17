export const PATTERNS = {
  code: /^[A-Z0-9][A-Z0-9_-]{1,23}$/,
  sku: /^[A-Z0-9][A-Z0-9_-]{1,31}$/,
  barcode: /^[A-Za-z0-9-]{6,24}$/,
  email: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  mobilePk: /^03\d{9}$/,
  phone: /^(?:03\d{9}|\+923\d{9}|0\d{2,3}-?\d{6,8}|[+\d][\d\s-]{6,15})$/,
  ntn: /^\d{7}(?:-\d)?$/,
  cnic: /^\d{5}-\d{7}-\d$/,
};

/**
 * Validates a single input field and returns a user-friendly error message
 * (empty string "" when valid).
 */
export function validateField(type, value, options = {}) {
  const { required = false, minLength = 2, min = 0, strictPositive = false, label = 'Value' } = options;
  const raw = value === null || value === undefined ? '' : String(value);
  const str = raw.trim();

  if (!str) {
    return required ? `${label} is required.` : '';
  }

  switch (type) {
    case 'required':
      return str.length < minLength ? `${label} must be at least ${minLength} characters.` : '';
    case 'code': {
      const upper = str.toUpperCase();
      return PATTERNS.code.test(upper)
        ? ''
        : 'Use 2–24 letters, numbers, or dashes (e.g. COMP-001).';
    }
    case 'sku': {
      const upper = str.toUpperCase();
      return PATTERNS.sku.test(upper)
        ? ''
        : 'Use 2–32 letters, numbers, or dashes (e.g. SKU-001).';
    }
    case 'barcode':
      return PATTERNS.barcode.test(str) ? '' : 'Barcode must be 6–24 letters, digits, or dashes.';
    case 'email':
      return PATTERNS.email.test(str) ? '' : 'Enter a valid email address (e.g. name@company.com).';
    case 'mobilePk':
      return PATTERNS.mobilePk.test(str)
        ? ''
        : 'Enter an 11-digit mobile number starting with 03 (e.g. 03001234567).';
    case 'phone':
      return PATTERNS.phone.test(str)
        ? ''
        : 'Enter a valid phone or mobile number (e.g. 03001234567).';
    case 'ntn':
      return PATTERNS.ntn.test(str) ? '' : 'Format must be 7 digits or 1234567-8.';
    case 'cnic':
      return PATTERNS.cnic.test(str) ? '' : 'Format must be 42101-1234567-1.';
    case 'password':
      return raw.length < (options.minLength ?? 6)
        ? `Password must be at least ${options.minLength ?? 6} characters.`
        : '';
    case 'positive': {
      const num = Number(value);
      if (Number.isNaN(num)) return `${label} must be a valid number.`;
      if (strictPositive && num <= 0) return `${label} must be greater than 0.`;
      if (num < min) return `${label} cannot be less than ${min}.`;
      return '';
    }
    default:
      return '';
  }
}

/**
 * Generates an uppercase code suggestion (e.g. COMP-001) avoiding collisions when existingCodes is given.
 */
export function suggestCode(prefix = 'ITEM', countOrSeed = 0, existingCodes = []) {
  const cleanPrefix =
    String(prefix || 'ITEM')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 8) || 'ITEM';

  const usedSet = new Set(
    (Array.isArray(existingCodes) ? existingCodes : [])
      .map((c) => String(c || '').trim().toUpperCase())
      .filter(Boolean)
  );

  let nextNumber = 1;
  if (typeof countOrSeed === 'number' && !Number.isNaN(countOrSeed)) {
    nextNumber = Math.max(1, Math.floor(countOrSeed) + 1);
  } else if (typeof countOrSeed === 'string' && countOrSeed.trim()) {
    const cleanSeed = countOrSeed.trim().toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 10);
    if (cleanSeed) {
      const candidate = `${cleanPrefix}-${cleanSeed}`;
      if (!usedSet.has(candidate)) return candidate;
    }
  }

  let candidate = `${cleanPrefix}-${String(nextNumber).padStart(3, '0')}`;
  while (usedSet.has(candidate)) {
    nextNumber += 1;
    candidate = `${cleanPrefix}-${String(nextNumber).padStart(3, '0')}`;
  }
  return candidate;
}

const round2 = (n) => Number((Number(n) || 0).toFixed(2));

/**
 * Calculates balanced Wholesale (+10%) and POS Retail (+20%) rates across base & packing units.
 */
export function suggestTierRates(purchaseRate = 0, conversionQty = 1) {
  const basePurchase = Math.max(0, round2(purchaseRate));
  const qty = Math.max(1, Number(conversionQty) || 1);
  const baseWholesale = round2(basePurchase * 1.1);
  const baseRetail = round2(basePurchase * 1.2);

  return {
    basePurchaseRate: basePurchase,
    baseWholesaleRate: baseWholesale,
    baseRetailRate: baseRetail,
    packPurchaseRate: round2(basePurchase * qty),
    packWholesaleRate: round2(baseWholesale * qty),
    packRetailRate: round2(baseRetail * qty),
  };
}

export default {
  PATTERNS,
  validateField,
  suggestCode,
  suggestTierRates,
};
