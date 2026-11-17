import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Pencil, Play, Plus, SlidersHorizontal, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { ConfirmModal, FormModal, MetricCard, SmartDataTable } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';
import { extractListPayload, formatDateTime } from '../../utils/formatters';

const EMPTY_FORM = {
  ruleKey: '',
  ruleName: '',
  triggerEvent: 'LOW_STOCK',
  actionType: 'CREATE_PURCHASE_DRAFT',
  thresholdValue: 10,
  description: '',
  isEnabled: true,
};

export default function AutomationRulesPage() {
  const { user } = useAuth();
  const { addToast } = useShell();
  const queryClient = useQueryClient();

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const automationQuery = useQuery({
    queryKey: ['automation-rules', user?.distributorId],
    queryFn: async () => extractListPayload(await apiClient.get('/rules/automation')).data,
  });

  const notificationsQuery = useQuery({
    queryKey: ['automation-alerts', user?.distributorId],
    queryFn: async () =>
      extractListPayload(await apiClient.get('/dashboards-reports/notifications', { params: { limit: 15 } })).data,
  });

  const saveRuleMutation = useMutation({
    mutationFn: (payload) =>
      editingRule
        ? apiClient.put(`/rules/automation/${editingRule._id}`, payload)
        : apiClient.post('/rules/automation', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      addToast({ type: 'success', message: editingRule ? 'Automation rule updated.' : 'Automation rule created.' });
      setModalOpen(false);
      setEditingRule(null);
      setForm(EMPTY_FORM);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not save automation rule.' });
    },
  });

  const toggleRuleMutation = useMutation({
    mutationFn: (id) => apiClient.patch(`/rules/automation/${id}/toggle`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      addToast({ type: 'info', message: 'Automation trigger state toggled.' });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not toggle automation rule.' });
    },
  });

  const deleteRuleMutation = useMutation({
    mutationFn: (id) => apiClient.delete(`/rules/automation/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['automation-rules'] });
      addToast({ type: 'success', message: 'Automation rule deleted.' });
      setDeleteTarget(null);
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Could not delete automation rule.' });
    },
  });

  const sweepMutation = useMutation({
    mutationFn: () => apiClient.post('/rules/automation/evaluate'),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['automation-alerts'] });
      queryClient.invalidateQueries({ queryKey: ['topbar-notifications'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-orders'] });
      queryClient.invalidateQueries({ queryKey: ['procurement-summary'] });
      const result = res.data?.data || {};
      const count = result.generatedAlertsCount ?? 0;
      const draftCode = result.draftedPurchase?.movementCode;
      addToast({
        type: 'success',
        message: draftCode
          ? `Sweep finished: ${count} alerts and PR draft ${draftCode} queued.`
          : `Sweep finished: ${count} new alerts evaluated with idempotent guard.`,
      });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Automation sweep failed.' });
    },
  });

  const rules = automationQuery.data || [];
  const alerts = notificationsQuery.data || [];

  const openCreateModal = () => {
    setEditingRule(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (rule) => {
    setEditingRule(rule);
    setForm({
      ruleKey: rule.ruleKey || '',
      ruleName: rule.ruleName || '',
      triggerEvent: rule.triggerEvent || 'LOW_STOCK',
      actionType: rule.actionType || 'NOTIFY_ADMIN',
      thresholdValue: Number(rule.thresholdValue ?? 0),
      description: rule.description || '',
      isEnabled: rule.isEnabled !== false,
    });
    setModalOpen(true);
  };

  const ruleColumns = [
    { key: 'ruleName', header: 'Rule Name', mobilePrimary: true, accessor: 'ruleName' },
    { key: 'triggerEvent', header: 'Trigger', accessor: (r) => r.triggerEvent || 'LOW_STOCK' },
    { key: 'actionType', header: 'Action', accessor: (r) => r.actionType || 'NOTIFY_ADMIN' },
    { key: 'thresholdValue', header: 'Threshold', numeric: true, align: 'right', accessor: (r) => r.thresholdValue ?? 0 },
    {
      key: 'isEnabled',
      header: 'State',
      mobileBadge: true,
      render: (r) => <StatusBadge status={r.isEnabled ? 'ACTIVE' : 'INACTIVE'} />,
    },
  ];

  const alertColumns = [
    { key: 'alertCategory', header: 'Category', render: (r) => <StatusBadge status={r.alertCategory} tone="warning" /> },
    { key: 'title', header: 'Alert Title', mobilePrimary: true, accessor: 'title' },
    { key: 'message', header: 'Details', accessor: 'message' },
    { key: 'createdAt', header: 'Time', accessor: (r) => formatDateTime(r.createdAt) },
  ];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title="Business Automation Rules & Alerts"
        subtitle="Configure Low-Stock Auto-Purchase drafts, Expiry warnings, Credit limits, and alert evaluation sweeps"
        actions={
          <>
            <button
              type="button"
              onClick={() => sweepMutation.mutate()}
              disabled={sweepMutation.isPending}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border bg-[var(--bg-surface)] text-xs font-semibold hover:bg-[var(--bg-elevated)]"
            >
              <Play className="w-3.5 h-3.5 text-[var(--accent-primary)]" />
              <span>{sweepMutation.isPending ? 'Running Sweep...' : 'Run Sweep Now'}</span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Add Rule</span>
            </button>
          </>
        }
      />

      <div className="shrink-0 grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MetricCard title="Configured Rules" value={rules.length} icon={SlidersHorizontal} status="primary" loading={automationQuery.isLoading} />
        <MetricCard title="Active Rules" value={rules.filter((r) => r.isEnabled).length} status="success" loading={automationQuery.isLoading} />
        <MetricCard title="Unread Alerts" value={alerts.filter((a) => !a.isRead).length} icon={Bell} status="danger" loading={notificationsQuery.isLoading} />
        <MetricCard title="Idempotency Guard" value="ACTIVE" subtitle="Zero duplicate PR drafts" status="info" />
      </div>

      <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-3 overflow-hidden">
        <SmartDataTable
          columns={ruleColumns}
          data={rules}
          loading={automationQuery.isLoading}
          emptyTitle="No automation rules found"
          emptyDescription="Add a custom automation rule or run a sweep to evaluate thresholds."
          emptyActionLabel="Add Rule"
          onEmptyAction={openCreateModal}
          renderActions={(row) => (
            <>
              <button
                type="button"
                onClick={() => openEditModal(row)}
                aria-label={`Edit ${row.ruleName}`}
                className="p-1.5 rounded-lg border hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)]"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => toggleRuleMutation.mutate(row._id)}
                disabled={toggleRuleMutation.isPending}
                className="px-2.5 py-1.5 rounded-lg border text-xs font-medium hover:bg-[var(--bg-elevated)]"
              >
                {row.isEnabled ? 'Pause' : 'Enable'}
              </button>
              <button
                type="button"
                onClick={() => setDeleteTarget(row)}
                aria-label={`Delete ${row.ruleName}`}
                className="p-1.5 rounded-lg border hover:bg-[var(--bg-elevated)] text-[var(--status-danger)]"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        />

        <SmartDataTable
          columns={alertColumns}
          data={alerts}
          loading={notificationsQuery.isLoading}
          emptyTitle="No automation alerts fired yet"
          emptyDescription="Click Run Sweep Now to evaluate low stock batches, expiry windows, and credit limits."
        />
      </div>

      <FormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingRule(null);
        }}
        title={editingRule ? `Edit Rule — ${editingRule.ruleName}` : 'Configure Automation Rule'}
        size="sm"
        onSubmit={(e) => {
          e.preventDefault();
          saveRuleMutation.mutate(form);
        }}
        isSubmitting={saveRuleMutation.isPending}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Rule Name</label>
            <input
              required
              value={form.ruleName}
              onChange={(e) => setForm((p) => ({ ...p, ruleName: e.target.value }))}
              placeholder="Low Stock Auto-Purchase Requirement"
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Trigger Event</label>
              <select
                value={form.triggerEvent}
                onChange={(e) => setForm((p) => ({ ...p, triggerEvent: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="LOW_STOCK">Low Stock Batch</option>
                <option value="EXPIRY_WINDOW">Expiry Window</option>
                <option value="CREDIT_EXCEEDED">Credit Limit Exceeded</option>
                <option value="CHEQUE_BOUNCED">Bounced Cheque</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Action Type</label>
              <select
                value={form.actionType}
                onChange={(e) => setForm((p) => ({ ...p, actionType: e.target.value }))}
                className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                <option value="CREATE_PURCHASE_DRAFT">Create Purchase Draft</option>
                <option value="NOTIFY_WAREHOUSE">Notify Warehouse</option>
                <option value="NOTIFY_ADMIN">Notify Admin</option>
                <option value="NOTIFY_ACCOUNTS">Notify Accounts</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Threshold Value (Days / % / Qty)
            </label>
            <input
              type="number"
              min="0"
              value={form.thresholdValue}
              onChange={(e) => setForm((p) => ({ ...p, thresholdValue: Number(e.target.value) }))}
              className="w-full h-9 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm tabular-nums"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Description</label>
            <textarea
              rows={2}
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              placeholder="Explain when this automation fires..."
              className="w-full p-2.5 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>
        </div>
      </FormModal>

      <ConfirmModal
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => deleteRuleMutation.mutate(deleteTarget._id)}
        title="Delete Automation Rule?"
        description={`Remove "${deleteTarget?.ruleName}" from distributor automation workflows?`}
        confirmLabel="Delete Rule"
        variant="danger"
        isLoading={deleteRuleMutation.isPending}
      />
    </div>
  );
}
