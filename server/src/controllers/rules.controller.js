import { CommercialRule as _CommercialRule, PrintTemplate as _PrintTemplate } from '../models/index.js';
import { getTenantModels } from '../config/tenantDb.js';
import { AppError, asyncHandler } from '../middlewares/errorMiddleware.js';
import { buildPaginationQuery, buildScopedFilter } from '../middlewares/tenantMiddleware.js';
import {
  listAutomationRules,
  upsertAutomationRule,
  toggleAutomationRule,
  deleteAutomationRule,
  evaluateLowStockAndExpiryAlerts,
} from '../services/automationAlert.service.js';

const m = () => getTenantModels({ CommercialRule: _CommercialRule, PrintTemplate: _PrintTemplate });

function resolveCategoryFromRequest(req, forcedCategory = null) {
  if (forcedCategory) return forcedCategory;
  if (req.query.ruleCategory) return req.query.ruleCategory;
  const path = req.baseUrl + req.path;
  if (path.includes('/taxes')) return 'TAX';
  if (path.includes('/discounts')) return 'DISCOUNT';
  if (path.includes('/charges')) return 'CHARGE';
  if (path.includes('/schemes')) return 'SCHEME';
  return null;
}

export const listRules = (forcedCategory = null) =>
  asyncHandler(async (req, res) => {
    const { CommercialRule } = m();
    const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
    const extra = {};
    const category = resolveCategoryFromRequest(req, forcedCategory);
    if (category) extra.ruleCategory = category;
    if (req.query.level) extra.level = req.query.level;
    if (req.query.calculationMode) extra.calculationMode = req.query.calculationMode;
    if (req.query.status) extra.status = req.query.status;

    const filter = buildScopedFilter(req, extra, ['ruleName'], searchRegex);
    const [rules, totalRecords] = await Promise.all([
      CommercialRule.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .populate('schemeDetails.paidProductId schemeDetails.freeProductId', 'skuCode productName')
        .lean(),
      CommercialRule.countDocuments(filter),
    ]);

    const now = new Date();
    const enriched = rules.map((r) => {
      const isExpired = !r.timeline?.isAllTime && r.timeline?.endDate && new Date(r.timeline.endDate) < now;
      return { ...r, effectiveStatus: isExpired ? 'EXPIRED' : r.status };
    });

    res.status(200).json({ success: true, data: enriched, pagination: buildPaginationMeta(totalRecords) });
  });

export const createRule = (forcedCategory = null) =>
  asyncHandler(async (req, res) => {
    const { CommercialRule } = m();
    const ruleCategory = forcedCategory || req.body.ruleCategory;
    if (!ruleCategory) throw new AppError('ruleCategory is required.', 400, 'RULE_CATEGORY_REQUIRED');
    const created = await CommercialRule.create({ ...req.body, ruleCategory, distributorId: req.distributorId });
    res.status(201).json({ success: true, data: created });
  });

export const updateRule = asyncHandler(async (req, res) => {
  const { CommercialRule } = m();
  const rule = await CommercialRule.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!rule) throw new AppError('Commercial rule not found.', 404, 'RULE_NOT_FOUND');

  Object.assign(rule, { ...req.body, distributorId: req.distributorId });
  await rule.save();
  res.status(200).json({ success: true, data: rule });
});

export const deleteRule = asyncHandler(async (req, res) => {
  const { CommercialRule } = m();
  const deleted = await CommercialRule.findOneAndDelete({ _id: req.params.id, distributorId: req.distributorId });
  if (!deleted) throw new AppError('Commercial rule not found.', 404, 'RULE_NOT_FOUND');
  res.status(200).json({ success: true, message: 'Commercial rule deleted successfully.' });
});

export const listTemplates = asyncHandler(async (req, res) => {
  const { PrintTemplate } = m();
  const { skip, limit, sort, searchRegex, buildPaginationMeta } = buildPaginationQuery(req);
  const extra = {};
  if (req.query.documentType) extra.documentType = req.query.documentType;
  if (req.query.layoutType) extra.layoutType = req.query.layoutType;
  if (req.query.status) extra.status = req.query.status;

  const filter = buildScopedFilter(req, extra, ['templateCode', 'templateName'], searchRegex);
  const [templates, totalRecords] = await Promise.all([
    PrintTemplate.find(filter).sort(sort).skip(skip).limit(limit).lean(),
    PrintTemplate.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, data: templates, pagination: buildPaginationMeta(totalRecords) });
});

export const createTemplate = asyncHandler(async (req, res) => {
  const { PrintTemplate } = m();
  const templateCode = req.body.templateCode || `TPL-${Date.now().toString().slice(-5)}`;
  if (req.body.isDefault && req.body.documentType) {
    await PrintTemplate.updateMany(
      { distributorId: req.distributorId, documentType: req.body.documentType },
      { $set: { isDefault: false } }
    );
  }
  const created = await PrintTemplate.create({ ...req.body, templateCode, distributorId: req.distributorId });
  res.status(201).json({ success: true, data: created });
});

export const updateTemplate = asyncHandler(async (req, res) => {
  const { PrintTemplate } = m();
  const tpl = await PrintTemplate.findOne({ _id: req.params.id, distributorId: req.distributorId });
  if (!tpl) throw new AppError('Print template not found.', 404, 'TEMPLATE_NOT_FOUND');

  if (req.body.isDefault) {
    await PrintTemplate.updateMany(
      { distributorId: req.distributorId, documentType: req.body.documentType || tpl.documentType, _id: { $ne: tpl._id } },
      { $set: { isDefault: false } }
    );
  }

  Object.assign(tpl, { ...req.body, distributorId: req.distributorId });
  await tpl.save();
  res.status(200).json({ success: true, data: tpl });
});

export const deleteTemplate = asyncHandler(async (req, res) => {
  const { PrintTemplate } = m();
  const deleted = await PrintTemplate.findOneAndDelete({ _id: req.params.id, distributorId: req.distributorId });
  if (!deleted) throw new AppError('Print template not found.', 404, 'TEMPLATE_NOT_FOUND');
  res.status(200).json({ success: true, message: 'Print template deleted successfully.' });
});

export const getAutomationRules = asyncHandler(async (req, res) => {
  const rules = await listAutomationRules(req.distributorId);
  res.status(200).json({ success: true, data: rules });
});

export const saveAutomationRule = asyncHandler(async (req, res) => {
  const saved = await upsertAutomationRule(req.distributorId, req.body, req.params.id || null);
  res.status(req.params.id ? 200 : 201).json({ success: true, data: saved });
});

export const flipAutomationRule = asyncHandler(async (req, res) => {
  const updated = await toggleAutomationRule(req.distributorId, req.params.id);
  if (!updated) throw new AppError('Automation rule not found.', 404, 'AUTOMATION_RULE_NOT_FOUND');
  res.status(200).json({ success: true, data: updated });
});

export const removeAutomationRule = asyncHandler(async (req, res) => {
  const deleted = await deleteAutomationRule(req.distributorId, req.params.id);
  if (!deleted) throw new AppError('Automation rule not found.', 404, 'AUTOMATION_RULE_NOT_FOUND');
  res.status(200).json({ success: true, message: 'Automation rule deleted.' });
});

export const triggerAutomationEvaluation = asyncHandler(async (req, res) => {
  const result = await evaluateLowStockAndExpiryAlerts({
    distributorId: req.distributorId,
    actorId: req.user._id,
  });
  res.status(200).json({ success: true, data: result });
});

export default {
  listRules, createRule, updateRule, deleteRule, listTemplates, createTemplate, updateTemplate, deleteTemplate,
  getAutomationRules, saveAutomationRule, flipAutomationRule, removeAutomationRule, triggerAutomationEvaluation,
};
