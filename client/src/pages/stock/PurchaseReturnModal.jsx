import { useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useAuth } from '../../context/AuthContext';
import { useShell } from '../../context/ShellContext';
import { SearchableSelect } from '../../components/global';
import { extractListPayload, formatCurrency } from '../../utils/formatters';

export default function PurchaseReturnModal({ isOpen, onClose }) {
  const queryClient = useQueryClient();
  const { canViewPurchasePrice } = useAuth();
  const { addToast } = useShell();
  const pointerDownOnBackdrop = useRef(false);

  const [batchId, setBatchId] = useState('');
  const [returnQtyBase, setReturnQtyBase] = useState('');
  const [returnReason, setReturnReason] = useState('');
  const [idempotencyKey, setIdempotencyKey] = useState(() => `prn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);

  const batchesQuery = useQuery({
    queryKey: ['stock-batches-options', 'purchase-return'],
    queryFn: async () => extractListPayload(await apiClient.get('/stocks/batches', { params: { limit: 150 } })).data,
    enabled: isOpen,
  });

  const batches = useMemo(() => (batchesQuery.data || []).filter((b) => (b.availableBaseQty || 0) > 0), [batchesQuery.data]);
  const selectedBatch = useMemo(() => batches.find((b) => String(b._id) === String(batchId)) || null, [batches, batchId]);

  const batchOptions = useMemo(
    () =>
      batches.map((b) => ({
        value: b._id,
        label: `${b.batchNo} — ${b.productId?.productName || 'Product'}`,
        sublabel: `${b.condition || 'FRESH'} • Avail: ${b.availableBaseQty} Base`,
      })),
    [batches]
  );

  const mutation = useMutation({
    mutationFn: (payload) => apiClient.post('/stocks/purchase-returns', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stock-batches'] });
      queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
      addToast({ type: 'success', message: 'Purchase return recorded & batch balance updated.' });
      setBatchId('');
      setReturnQtyBase('');
      setReturnReason('');
      setIdempotencyKey(`prn-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
      onClose?.();
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Purchase return failed.' });
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    const qty = Number(returnQtyBase) || 0;
    if (!selectedBatch || qty <= 0) {
      addToast({ type: 'warning', message: 'Select a source batch and enter a valid return quantity.' });
      return;
    }
    if (qty > (selectedBatch.availableBaseQty || 0)) {
      addToast({ type: 'warning', message: `Cannot return more than available (${selectedBatch.availableBaseQty}).` });
      return;
    }
    mutation.mutate({
      idempotencyKey,
      batchId: selectedBatch._id,
      productId: selectedBatch.productId?._id || selectedBatch.productId,
      supplierCompanyId: selectedBatch.productId?.companyId || null,
      returnQtyBase: qty,
      returnReason: returnReason.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
      onPointerDown={(e) => {
        pointerDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onClick={(e) => {
        if (pointerDownOnBackdrop.current && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div className="w-full max-w-lg rounded-xl border bg-[var(--bg-surface)] shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)]">Purchase Return to Principal Company</h3>
            <p className="text-xs text-[var(--text-muted)]">Linked to source Stock Batch & Company Payable</p>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-[var(--bg-hover)]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Source Stock Batch <span className="text-[var(--status-danger)]">*</span>
            </label>
            <SearchableSelect
              options={batchOptions}
              value={batchId}
              onChange={(val) => {
                setBatchId(val);
                const found = batches.find((b) => String(b._id) === String(val));
                if (found && !returnQtyBase) setReturnQtyBase(String(found.availableBaseQty || 1));
              }}
              placeholder="Search batch no or product..."
              emptyLabel="No available batches"
            />
          </div>

          {selectedBatch && (
            <div className="rounded-lg border bg-[var(--bg-elevated)] p-2.5 grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-[var(--text-muted)]">Available Base Qty:</span>{' '}
                <strong className="font-mono">{selectedBatch.availableBaseQty}</strong>
              </div>
              <div>
                <span className="text-[var(--text-muted)]">Condition:</span>{' '}
                <strong>{selectedBatch.condition || 'FRESH'}</strong>
              </div>
              {canViewPurchasePrice && (
                <div className="col-span-2">
                  <span className="text-[var(--text-muted)]">Est. Payable Reduction:</span>{' '}
                  <strong className="font-mono text-[var(--accent-primary)]">
                    {formatCurrency((Number(returnQtyBase) || 0) * (Number(selectedBatch.purchaseRatePerBase) || 0))}
                  </strong>
                </div>
              )}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
              Return Quantity (Base Units) <span className="text-[var(--status-danger)]">*</span>
            </label>
            <input
              type="number"
              min="1"
              max={selectedBatch?.availableBaseQty || undefined}
              required
              value={returnQtyBase}
              onChange={(e) => setReturnQtyBase(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border bg-[var(--bg-elevated)] text-sm font-mono tabular-nums"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Return Reason</label>
            <textarea
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              placeholder="Damaged in transit, near expiry, or principal recall..."
              className="w-full min-h-[70px] px-3 py-2 rounded-lg border bg-[var(--bg-elevated)] text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t">
            <button type="button" onClick={onClose} className="h-9 px-3 rounded-lg border text-xs font-semibold">
              Cancel
            </button>
            <button
              type="submit"
              disabled={mutation.isPending}
              className="h-9 px-4 rounded-lg bg-[var(--accent-primary)] text-white text-xs font-semibold disabled:opacity-50"
            >
              {mutation.isPending ? 'Processing...' : 'Confirm Purchase Return'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
