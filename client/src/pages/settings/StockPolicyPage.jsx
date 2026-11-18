import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Check, Plus, ShieldCheck, SlidersHorizontal, Trash2 } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';

const POLICIES = [
  {
    id: 'FIFO',
    title: 'FIFO (First-In, First-Out)',
    desc: 'Allocates oldest received stock batches first using purchase date.',
  },
  {
    id: 'FEFO',
    title: 'FEFO (First-Expired, First-Out)',
    desc: 'Allocates earliest-expiring eligible batches first to prevent wastage.',
  },
  {
    id: 'MANUAL',
    title: 'Manual Batch Selection',
    desc: 'Uses explicitly picked batch IDs on orders, with FEFO fallback when unset.',
  },
];

const OFFICIAL_CONDITIONS = [
  { id: 'FRESH', note: 'New arrival, allocatable' },
  { id: 'NORMAL', note: 'Standard sellable condition' },
  { id: 'DAMAGE', note: 'Blocked from auto-allocation' },
  { id: 'EXPIRE', note: 'Blocked from auto-allocation' },
];

export default function StockPolicyPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [draftPolicy, setDraftPolicy] = useState(null);
  const [draftConditions, setDraftConditions] = useState(null);
  const [newLabel, setNewLabel] = useState('');
  const [mappedCondition, setMappedCondition] = useState('DAMAGE');

  const policyQuery = useQuery({
    queryKey: ['stock-policy'],
    queryFn: async () =>
      (await apiClient.get('/stocks/policy')).data?.data || {
        stockIssuePolicy: 'FEFO',
        customStockConditions: [],
      },
  });

  const activePolicy = draftPolicy ?? policyQuery.data?.stockIssuePolicy ?? 'FEFO';
  const customConditions = draftConditions ?? policyQuery.data?.customStockConditions ?? [];

  const saveMutation = useMutation({
    mutationFn: (payload) => apiClient.put('/stocks/policy', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-policy'] });
      queryClient.invalidateQueries({ queryKey: ['stock-batches'] });
      setDraftPolicy(null);
      setDraftConditions(null);
      addToast({ type: 'success', message: 'Stock issue policy & conditions saved.' });
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Failed to save stock policy.' });
    },
  });

  const handleSaveAll = () => {
    saveMutation.mutate({
      stockIssuePolicy: activePolicy,
      customStockConditions: customConditions,
    });
  };

  const handleAddCondition = (e) => {
    e.preventDefault();
    const trimmed = newLabel.trim();
    if (!trimmed) {
      addToast({ type: 'warning', message: 'Enter a custom condition label first.' });
      return;
    }
    const exists = customConditions.some((c) => c.label.toLowerCase() === trimmed.toLowerCase());
    if (exists) {
      addToast({ type: 'warning', message: 'This custom condition label already exists.' });
      return;
    }
    const nextList = [...customConditions, { label: trimmed, mappedSystemCondition: mappedCondition }];
    setDraftConditions(nextList);
    setNewLabel('');
    saveMutation.mutate({ stockIssuePolicy: activePolicy, customStockConditions: nextList });
  };

  const handleRemoveCondition = (labelToRemove) => {
    const nextList = customConditions.filter((c) => c.label !== labelToRemove);
    setDraftConditions(nextList);
    saveMutation.mutate({ stockIssuePolicy: activePolicy, customStockConditions: nextList });
  };

  return (
    <div className="lg:flex-1 lg:min-h-0 flex flex-col gap-3 animate-fade-in">
      <PageHeader
        title="Stock Issue Policy & Conditions"
        subtitle="Configure distributor FIFO/FEFO allocation rules and supplementary batch condition labels"
        actions={
          <>
            <button
              type="button"
              onClick={() => navigate('/stock/list')}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:h-9 sm:min-h-0 px-3 rounded-lg border bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Stock Batches</span>
            </button>
            <button
              type="button"
              disabled={policyQuery.isLoading || saveMutation.isPending}
              onClick={handleSaveAll}
              className="inline-flex items-center justify-center gap-1.5 min-h-[44px] sm:h-9 sm:min-h-0 px-4 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>{saveMutation.isPending ? 'Saving...' : 'Save Policy'}</span>
            </button>
          </>
        }
      />

      <div className="lg:flex-1 lg:min-h-0 lg:overflow-auto overscroll-contain space-y-4 pb-2">
        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <SlidersHorizontal className="w-4 h-4 text-[var(--accent-primary)]" />
                <span>Stock Issue Policy (PRD §6.3)</span>
              </h2>
              <p className="text-xs text-[var(--text-secondary)]">
                Controls default batch selection order during order approval and stock reservation.
              </p>
            </div>
            <StatusBadge status={activePolicy} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {POLICIES.map((p) => {
              const selected = activePolicy === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setDraftPolicy(p.id)}
                  className={`text-left rounded-xl border p-4 min-h-[44px] transition-colors ${
                    selected
                      ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]/50'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-canvas)] hover:bg-[var(--bg-elevated)]'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <StatusBadge status={p.id} />
                    {selected && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--accent-primary)]">
                        <Check className="w-3.5 h-3.5" />
                        Selected
                      </span>
                    )}
                  </div>
                  <p className="mt-2.5 text-sm font-semibold text-[var(--text-primary)]">{p.title}</p>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{p.desc}</p>
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-4">
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[var(--accent-primary)]" />
              <span>Official vs. Custom Supplementary Stock Conditions (PRD §6.5)</span>
            </h2>
            <p className="text-xs text-[var(--text-secondary)]">
              System allocation respects the 4 locked official conditions; add custom labels mapped cleanly onto them.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {OFFICIAL_CONDITIONS.map((item) => (
              <div key={item.id} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] p-3 flex items-center justify-between gap-2">
                <div>
                  <StatusBadge status={item.id} />
                  <p className="mt-1 text-[11px] text-[var(--text-muted)]">{item.note}</p>
                </div>
                <span className="text-[10px] font-semibold uppercase text-[var(--text-muted)]">Locked</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleAddCondition} className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end pt-2 border-t border-[var(--border-subtle)]">
            <div className="sm:col-span-5">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Custom Condition Label</label>
              <input
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => {
                  if (e.isComposing || e.keyCode === 229) return;
                }}
                placeholder="e.g. Box Torn, Heat Softened"
                className="w-full min-h-[44px] sm:h-9 sm:min-h-0 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              />
            </div>
            <div className="sm:col-span-4">
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Maps to Official Condition</label>
              <select
                value={mappedCondition}
                onChange={(e) => setMappedCondition(e.target.value)}
                className="w-full min-h-[44px] sm:h-9 sm:min-h-0 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm"
              >
                {OFFICIAL_CONDITIONS.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <button
                type="submit"
                disabled={saveMutation.isPending || policyQuery.isLoading}
                className="w-full min-h-[44px] sm:h-9 sm:min-h-0 px-3.5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Add Custom Label</span>
              </button>
            </div>
          </form>

          {customConditions.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-2">
              No custom supplementary condition labels added yet.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
              {customConditions.map((c) => (
                <div
                  key={c.label}
                  className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-canvas)] px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-[var(--text-primary)] truncate">{c.label}</span>
                    <StatusBadge status={c.mappedSystemCondition} />
                  </div>
                  <button
                    type="button"
                    disabled={saveMutation.isPending}
                    onClick={() => handleRemoveCondition(c.label)}
                    aria-label={`Remove ${c.label}`}
                    className="min-h-[44px] sm:min-h-0 px-2 py-1.5 rounded-lg border border-[var(--status-danger)]/30 text-[var(--status-danger)] hover:bg-[var(--status-danger)]/10 text-xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
