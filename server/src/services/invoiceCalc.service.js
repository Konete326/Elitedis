const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;

function isRuleValid(rule, now = new Date()) {
  if (!rule || (rule.status && rule.status !== 'ACTIVE')) return false;
  const tl = rule.timeline;
  if (!tl || tl.isAllTime) return true;
  if (tl.startDate && now < new Date(tl.startDate)) return false;
  if (tl.endDate && now > new Date(tl.endDate)) return false;
  return true;
}

function calcItemDiscount({ grossRateTotal, baseRate, customSaleRate, quantity, discountRule, discountInput }) {
  if (customSaleRate !== undefined && customSaleRate !== null && customSaleRate !== '' && Number(customSaleRate) >= 0) {
    const targetRate = Number(customSaleRate);
    const diff = Math.max(0, baseRate - targetRate);
    return {
      amount: round2(diff * quantity),
      effectiveSaleRate: round2(targetRate),
      effectiveDiscountPct: baseRate > 0 ? round2((diff / baseRate) * 100) : 0,
    };
  }
  const mode = discountInput?.mode || discountRule?.calculationMode || 'NONE';
  const value = Number(discountInput?.value ?? discountRule?.benefitValue ?? 0);
  if (!value || mode === 'NONE') {
    return { amount: 0, effectiveSaleRate: round2(baseRate), effectiveDiscountPct: 0 };
  }
  if (mode === 'PERCENTAGE' || mode === 'FIX_PERCENT' || mode === 'ADVANCE_PERCENT') {
    const amount = round2((grossRateTotal * value) / 100);
    return { amount, effectiveSaleRate: round2(baseRate * (1 - value / 100)), effectiveDiscountPct: round2(value) };
  }
  const rawFlat = discountInput?.isTotalFlat ? value : value * quantity;
  const amount = round2(Math.min(grossRateTotal, Math.max(0, rawFlat)));
  return {
    amount,
    effectiveSaleRate: quantity > 0 ? round2((grossRateTotal - amount) / quantity) : round2(baseRate),
    effectiveDiscountPct: grossRateTotal > 0 ? round2((amount / grossRateTotal) * 100) : 0,
  };
}

function calcItemCharge({ grossRateTotal, discountedAmount, quantity, totalWeightKg, chargeRule, chargeInput }) {
  const mode = chargeInput?.mode || chargeRule?.calculationMode || 'NONE';
  const basis = chargeInput?.compareBasis || chargeRule?.compareBasis || 'NONE';
  const value = Number(chargeInput?.value ?? chargeRule?.benefitValue ?? 0);
  const threshold = Number(chargeInput?.thresholdValue ?? chargeRule?.thresholdValue ?? 1) || 1;
  if (!value || mode === 'NONE') return 0;
  if (mode === 'PERCENTAGE' || mode === 'FIX_PERCENT') {
    return round2(((basis === 'RATE' ? discountedAmount : grossRateTotal) * value) / 100);
  }
  if (basis === 'WEIGHT_KG') return round2((totalWeightKg / threshold) * value);
  if (basis === 'QUANTITY') return round2((quantity / threshold) * value);
  if (basis === 'RATE') return round2(value * quantity);
  return round2(value);
}

function calcItemTax({ taxableAmount, quantity, taxRule, taxInput }) {
  const mode = taxInput?.mode || taxRule?.calculationMode || 'NONE';
  const value = Number(taxInput?.value ?? taxRule?.benefitValue ?? 0);
  if (!value || mode === 'NONE') return 0;
  if (mode === 'PERCENTAGE' || mode === 'FIX_PERCENT') return round2((taxableAmount * value) / 100);
  return round2(taxInput?.perUnit ? value * quantity : value);
}

function calcGrandRule({ mode, compareBasis, thresholdValue, benefitValue, amountBasis, weightBasis }) {
  const value = Number(benefitValue || 0);
  const threshold = Number(thresholdValue || 0);
  if (!value || !mode || mode === 'NONE') return 0;
  const metric = compareBasis === 'WEIGHT_KG' ? weightBasis : amountBasis;
  if (mode === 'FIX_GENERAL' || mode === 'GENERAL_FLAT') return round2(value);
  if (mode === 'FIX_PERCENT' || mode === 'PERCENTAGE') {
    return threshold > 0 && metric < threshold ? 0 : round2((amountBasis * value) / 100);
  }
  if (mode === 'GENERAL_AUTO') {
    return threshold <= 0 || metric < threshold ? 0 : round2(Math.floor(metric / threshold) * value);
  }
  if (mode === 'SLAB_GENERAL') return threshold > 0 && metric < threshold ? 0 : round2(value);
  return 0;
}

function makeFreeRow({ productId, productName, skuCode, unitName, conversionQty, unitWeightKg, unitVolumeCubic, quantity, schemeRuleId }) {
  return {
    productId,
    batchId: null,
    productName: productName || 'Free Scheme Item',
    skuCode: skuCode || '',
    unitName: unitName || 'Piece',
    conversionQty: Number(conversionQty) || 1,
    unitWeightKg,
    unitVolumeCubic,
    baseRate: 0,
    customSaleRate: 0,
    effectiveDiscountPct: 100,
    quantity,
    grossRateTotal: 0,
    totalWeightKg: round3(unitWeightKg * quantity),
    itemDiscountRuleId: null,
    itemDiscountAmount: 0,
    itemChargeRuleId: null,
    itemChargeAmount: 0,
    itemTaxRuleId: null,
    itemTaxAmount: 0,
    schemeRuleId: schemeRuleId || null,
    isFreeSchemeRow: true,
    netLineAmount: 0,
  };
}

/**
 * Pure 2-Level Invoice & Order Calculation Engine.
 * Level 1 computes item rates, reverse sale-rate discounts, charges, GST, and free scheme rows.
 * Level 2 aggregates totals and evaluates grand-level discounts, charges, taxes, and target schemes.
 */
export function calculateTwoLevelInvoice(payload = {}, options = {}) {
  const {
    lineItems = [],
    invoiceRules = {},
    grandDiscountRule = null,
    grandDiscountInput = null,
    grandChargeRule = null,
    grandChargeInput = null,
    grandTaxRule = null,
    grandTaxInput = null,
    grandSchemeRule = null,
    grandSchemeInput = null,
    extraGrandDiscountPkr = 0,
  } = payload;
  const { ruleMap = new Map(), now = new Date() } = options;

  const resolveRule = (explicitRule, ruleId) => {
    const candidate = explicitRule && typeof explicitRule === 'object' ? explicitRule : ruleId ? ruleMap.get(String(ruleId)) : null;
    return isRuleValid(candidate, now) ? candidate : null;
  };

  const allow = {
    discount: invoiceRules.discountAllow !== false,
    tax: invoiceRules.taxAllow !== false,
    scheme: invoiceRules.schemeAllow !== false,
    charges: invoiceRules.chargesAllow !== false,
  };

  const computedRows = [];
  let totalPaidItems = 0, totalQuantity = 0, totalWeightKg = 0, totalVolumeCubic = 0;
  let grossAmount = 0, totalItemDiscounts = 0, totalItemCharges = 0, totalItemTaxes = 0, subtotalAfterItems = 0;

  for (const raw of lineItems) {
    if (raw.isFreeSchemeRow && !raw.keepManualFreeRow) continue;
    const quantity = Math.max(0, Number(raw.quantity) || 0);
    const unitWeightKg = Math.max(0, Number(raw.unitWeightKg) || 0);
    const unitVolumeCubic = Math.max(0, Number(raw.unitVolumeCubic) || 0);
    const baseRate = Math.max(0, Number(raw.baseRate) || 0);
    const grossRateTotal = round2(baseRate * quantity);
    const lineWeightKg = round3(unitWeightKg * quantity);
    const lineVolumeCubic = round3(unitVolumeCubic * quantity);
    const perms = raw.rulePermissions || {};

    const dRule = resolveRule(raw.itemDiscountRule, raw.itemDiscountRuleId);
    const dRes = allow.discount && perms.discountAllow !== false
      ? calcItemDiscount({ grossRateTotal, baseRate, customSaleRate: raw.customSaleRate, quantity, discountRule: dRule, discountInput: raw.discountInput })
      : { amount: 0, effectiveSaleRate: round2(baseRate), effectiveDiscountPct: 0 };

    const discounted = round2(Math.max(0, grossRateTotal - dRes.amount));
    const cRule = resolveRule(raw.itemChargeRule, raw.itemChargeRuleId);
    const itemChargeAmount = allow.charges && perms.chargesAllow !== false
      ? calcItemCharge({ grossRateTotal, discountedAmount: discounted, quantity, totalWeightKg: lineWeightKg, chargeRule: cRule, chargeInput: raw.chargeInput })
      : 0;

    const tRule = resolveRule(raw.itemTaxRule, raw.itemTaxRuleId);
    const itemTaxAmount = allow.tax && perms.taxAllow !== false
      ? calcItemTax({ taxableAmount: discounted + itemChargeAmount, quantity, taxRule: tRule, taxInput: raw.taxInput })
      : 0;

    const netLineAmount = round2(discounted + itemChargeAmount + itemTaxAmount);
    computedRows.push({
      productId: raw.productId,
      batchId: raw.batchId || null,
      productName: raw.productName || '',
      skuCode: raw.skuCode || '',
      unitName: raw.unitName || 'Piece',
      conversionQty: Number(raw.conversionQty) || 1,
      unitWeightKg,
      unitVolumeCubic,
      baseRate: round2(baseRate),
      customSaleRate: dRes.effectiveSaleRate,
      effectiveDiscountPct: dRes.effectiveDiscountPct,
      quantity,
      grossRateTotal,
      totalWeightKg: lineWeightKg,
      itemDiscountRuleId: dRule?._id || raw.itemDiscountRuleId || null,
      itemDiscountAmount: dRes.amount,
      itemChargeRuleId: cRule?._id || raw.itemChargeRuleId || null,
      itemChargeAmount,
      itemTaxRuleId: tRule?._id || raw.itemTaxRuleId || null,
      itemTaxAmount,
      schemeRuleId: null,
      isFreeSchemeRow: false,
      netLineAmount,
    });

    totalPaidItems += 1;
    totalQuantity = round3(totalQuantity + quantity);
    totalWeightKg = round3(totalWeightKg + lineWeightKg);
    totalVolumeCubic = round3(totalVolumeCubic + lineVolumeCubic);
    grossAmount = round2(grossAmount + grossRateTotal);
    totalItemDiscounts = round2(totalItemDiscounts + dRes.amount);
    totalItemCharges = round2(totalItemCharges + itemChargeAmount);
    totalItemTaxes = round2(totalItemTaxes + itemTaxAmount);
    subtotalAfterItems = round2(subtotalAfterItems + netLineAmount);

    const sRule = resolveRule(raw.schemeRule, raw.schemeRuleId);
    const details = raw.schemeInput || sRule?.schemeDetails;
    if (allow.scheme && perms.schemeAllow !== false && details) {
      const paidQty = Number(details.paidQty ?? sRule?.thresholdValue ?? 0);
      const freeUnitQty = Number(details.freeQty ?? sRule?.benefitValue ?? 0);
      if (paidQty > 0 && freeUnitQty > 0 && quantity >= paidQty) {
        const mode = sRule?.calculationMode || raw.schemeInput?.mode || 'PRODUCT_WISE_SCHEME';
        const freeTotal = mode === 'SLAB_SCHEME' ? freeUnitQty : Math.floor(quantity / paidQty) * freeUnitQty;
        if (freeTotal > 0) {
          const fw = Number(details.freeUnitWeightKg) > 0 ? Number(details.freeUnitWeightKg) : unitWeightKg;
          const fv = Number(details.freeUnitVolumeCubic) > 0 ? Number(details.freeUnitVolumeCubic) : unitVolumeCubic;
          const row = makeFreeRow({
            productId: details.freeProductId || raw.productId,
            productName: details.freeProductName || `${raw.productName || 'Item'} (Free Scheme)`,
            skuCode: raw.skuCode,
            unitName: details.freeUnit || raw.unitName || 'Piece',
            conversionQty: raw.conversionQty,
            unitWeightKg: fw,
            unitVolumeCubic: fv,
            quantity: freeTotal,
            schemeRuleId: sRule?._id || raw.schemeInput?.schemeRuleId,
          });
          computedRows.push(row);
          totalQuantity = round3(totalQuantity + freeTotal);
          totalWeightKg = round3(totalWeightKg + row.totalWeightKg);
          totalVolumeCubic = round3(totalVolumeCubic + round3(fv * freeTotal));
        }
      }
    }
  }

  const gDisc = resolveRule(grandDiscountRule, payload.grandDiscountRuleId);
  let grandDiscountAmount = allow.discount && (gDisc || grandDiscountInput)
    ? calcGrandRule({
        mode: grandDiscountInput?.mode || gDisc?.calculationMode,
        compareBasis: grandDiscountInput?.compareBasis || gDisc?.compareBasis || 'AMOUNT_PKR',
        thresholdValue: grandDiscountInput?.thresholdValue ?? gDisc?.thresholdValue ?? 0,
        benefitValue: grandDiscountInput?.value ?? gDisc?.benefitValue ?? 0,
        amountBasis: subtotalAfterItems,
        weightBasis: totalWeightKg,
      })
    : 0;
  grandDiscountAmount = round2(Math.min(subtotalAfterItems, grandDiscountAmount + Math.max(0, Number(extraGrandDiscountPkr) || 0)));

  const gChg = resolveRule(grandChargeRule, payload.grandChargeRuleId);
  const grandChargeAmount = allow.charges && (gChg || grandChargeInput)
    ? calcGrandRule({
        mode: grandChargeInput?.mode || gChg?.calculationMode,
        compareBasis: grandChargeInput?.compareBasis || gChg?.compareBasis || 'AMOUNT_PKR',
        thresholdValue: grandChargeInput?.thresholdValue ?? gChg?.thresholdValue ?? 0,
        benefitValue: grandChargeInput?.value ?? gChg?.benefitValue ?? 0,
        amountBasis: Math.max(0, subtotalAfterItems - grandDiscountAmount),
        weightBasis: totalWeightKg,
      })
    : 0;

  const gTax = resolveRule(grandTaxRule, payload.grandTaxRuleId);
  const grandTaxAmount = allow.tax && (gTax || grandTaxInput)
    ? calcGrandRule({
        mode: grandTaxInput?.mode || gTax?.calculationMode,
        compareBasis: grandTaxInput?.compareBasis || gTax?.compareBasis || 'AMOUNT_PKR',
        thresholdValue: grandTaxInput?.thresholdValue ?? gTax?.thresholdValue ?? 0,
        benefitValue: grandTaxInput?.value ?? gTax?.benefitValue ?? 0,
        amountBasis: Math.max(0, subtotalAfterItems - grandDiscountAmount + grandChargeAmount),
        weightBasis: totalWeightKg,
      })
    : 0;

  const gScheme = resolveRule(grandSchemeRule, payload.grandSchemeRuleId);
  if (allow.scheme && (gScheme || grandSchemeInput)) {
    const src = grandSchemeInput || gScheme;
    const basis = src.compareBasis === 'WEIGHT_KG' ? totalWeightKg : subtotalAfterItems;
    const details = src.schemeDetails || src;
    const freeQty = Number(details?.freeQty ?? src.benefitValue ?? 0);
    if (Number(src.thresholdValue || 0) > 0 && basis >= Number(src.thresholdValue) && freeQty > 0) {
      const row = makeFreeRow({
        productId: details?.freeProductId || null,
        productName: details?.freeProductName || src.ruleName || 'Grand Target Free Item',
        unitName: details?.freeUnit || 'Piece',
        unitWeightKg: Number(details?.freeUnitWeightKg || 0),
        unitVolumeCubic: 0,
        quantity: freeQty,
        schemeRuleId: gScheme?._id || null,
      });
      computedRows.push(row);
      totalQuantity = round3(totalQuantity + freeQty);
      totalWeightKg = round3(totalWeightKg + row.totalWeightKg);
    }
  }

  const netPayableAmount = round2(Math.max(0, subtotalAfterItems - grandDiscountAmount + grandChargeAmount + grandTaxAmount));

  return {
    lineItems: computedRows,
    grandSummary: {
      totalItems: totalPaidItems,
      totalRows: computedRows.length,
      totalQuantity,
      totalWeightKg,
      totalVolumeCubic,
      grossAmount,
      totalItemDiscounts,
      totalItemCharges,
      totalItemTaxes,
      subtotalAfterItems,
      grandDiscountRuleId: gDisc?._id || payload.grandDiscountRuleId || null,
      grandDiscountAmount,
      grandChargeRuleId: gChg?._id || payload.grandChargeRuleId || null,
      grandChargeAmount,
      grandTaxRuleId: gTax?._id || payload.grandTaxRuleId || null,
      grandTaxAmount,
      netPayableAmount,
    },
  };
}

export default { calculateTwoLevelInvoice };
