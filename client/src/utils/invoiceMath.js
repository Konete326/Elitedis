export function calculateLiveOrderSummary({
  lineItems = [],
  invoiceRules = {},
  ruleMap = new Map(),
  grandDiscountRuleId = '',
  grandChargeRuleId = '',
  extraGrandDiscountPkr = 0,
}) {
  let grossAmount = 0;
  let totalItemDiscounts = 0;
  let totalItemCharges = 0;
  let totalItemTaxes = 0;
  let totalWeightKg = 0;
  let totalQuantity = 0;

  const computedRows = lineItems.map((item) => {
    const qty = Math.max(0, Number(item.quantity) || 0);
    const rate = Math.max(0, Number(item.baseRate) || 0);
    const gross = rate * qty;
    const lineWeight = (Number(item.unitWeightKg) || 0) * qty;

    let disc = 0;
    let effRate = rate;
    if (invoiceRules.discountAllow !== false) {
      if (item.customSaleRate !== '' && item.customSaleRate !== null && item.customSaleRate !== undefined) {
        effRate = Math.max(0, Number(item.customSaleRate) || 0);
        disc = Math.max(0, (rate - effRate) * qty);
      } else if (item.itemDiscountRuleId && ruleMap.has(item.itemDiscountRuleId)) {
        const r = ruleMap.get(item.itemDiscountRuleId);
        disc = r.calculationMode === 'PERCENTAGE' ? (gross * (r.benefitValue || 0)) / 100 : (r.benefitValue || 0) * qty;
        effRate = qty > 0 ? (gross - disc) / qty : rate;
      }
    }

    const afterDisc = Math.max(0, gross - disc);
    let charge = 0;
    if (invoiceRules.chargesAllow !== false && item.itemChargeRuleId && ruleMap.has(item.itemChargeRuleId)) {
      const c = ruleMap.get(item.itemChargeRuleId);
      charge = c.calculationMode === 'PERCENTAGE' ? (afterDisc * (c.benefitValue || 0)) / 100 : (c.benefitValue || 0) * qty;
    }

    let tax = 0;
    if (invoiceRules.taxAllow !== false && item.itemTaxRuleId && ruleMap.has(item.itemTaxRuleId)) {
      const t = ruleMap.get(item.itemTaxRuleId);
      tax = t.calculationMode === 'PERCENTAGE' ? ((afterDisc + charge) * (t.benefitValue || 0)) / 100 : t.benefitValue || 0;
    }

    const net = Number((afterDisc + charge + tax).toFixed(2));
    grossAmount += gross;
    totalItemDiscounts += disc;
    totalItemCharges += charge;
    totalItemTaxes += tax;
    totalWeightKg += lineWeight;
    totalQuantity += qty;

    return {
      ...item,
      customSaleRate: Number(effRate.toFixed(2)),
      effectiveDiscountPct: rate > 0 ? Number((((rate - effRate) / rate) * 100).toFixed(2)) : 0,
      grossRateTotal: Number(gross.toFixed(2)),
      itemDiscountAmount: Number(disc.toFixed(2)),
      itemChargeAmount: Number(charge.toFixed(2)),
      itemTaxAmount: Number(tax.toFixed(2)),
      totalWeightKg: Number(lineWeight.toFixed(3)),
      netLineAmount: net,
    };
  });

  const subtotal = Math.max(0, grossAmount - totalItemDiscounts + totalItemCharges + totalItemTaxes);
  let grandDisc = Number(extraGrandDiscountPkr) || 0;
  if (invoiceRules.discountAllow !== false && grandDiscountRuleId && ruleMap.has(grandDiscountRuleId)) {
    const gr = ruleMap.get(grandDiscountRuleId);
    const metric = gr.compareBasis === 'WEIGHT_KG' ? totalWeightKg : subtotal;
    if (gr.calculationMode === 'GENERAL_AUTO' && gr.thresholdValue > 0) {
      grandDisc += Math.floor(metric / gr.thresholdValue) * (gr.benefitValue || 0);
    } else if (metric >= (gr.thresholdValue || 0)) {
      grandDisc += gr.calculationMode === 'PERCENTAGE' ? (subtotal * (gr.benefitValue || 0)) / 100 : gr.benefitValue || 0;
    }
  }

  let grandCharge = 0;
  if (invoiceRules.chargesAllow !== false && grandChargeRuleId && ruleMap.has(grandChargeRuleId)) {
    const gc = ruleMap.get(grandChargeRuleId);
    grandCharge = gc.calculationMode === 'FIX_PERCENT' ? (subtotal * (gc.benefitValue || 0)) / 100 : gc.benefitValue || 0;
  }

  const netPayableAmount = Number(Math.max(0, subtotal - grandDisc + grandCharge).toFixed(2));
  return {
    lineItems: computedRows,
    grandSummary: {
      totalItems: computedRows.length,
      totalQuantity,
      totalWeightKg: Number(totalWeightKg.toFixed(3)),
      grossAmount: Number(grossAmount.toFixed(2)),
      totalItemDiscounts: Number(totalItemDiscounts.toFixed(2)),
      grandDiscountAmount: Number(grandDisc.toFixed(2)),
      grandChargeAmount: Number(grandCharge.toFixed(2)),
      netPayableAmount,
    },
  };
}
