import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Calculator, CheckCircle2, Save } from 'lucide-react';
import apiClient from '../../services/apiClient';
import { useShell } from '../../context/ShellContext';
import { TouchKeypadModal } from '../../components/global';
import PageHeader from '../../components/shared/PageHeader';
import StatusBadge from '../../components/shared/StatusBadge';

export default function ExecuteTaskPage() {
  const { taskId } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { addToast } = useShell();

  const [edits, setEdits] = useState({});
  const [keypadTarget, setKeypadTarget] = useState(null);

  const taskQuery = useQuery({
    queryKey: ['task-detail', taskId],
    queryFn: async () => {
      const response = await apiClient.get(`/tasks/${taskId}`);
      return response.data?.data;
    },
    enabled: Boolean(taskId),
  });

  const task = taskQuery.data;

  const commitMutation = useMutation({
    mutationFn: async ({ complete }) => {
      const items = (task?.checklistItems || []).map((item, idx) => ({
        ...item,
        verifiedQty: edits[idx]?.verifiedQty ?? item.verifiedQty ?? item.expectedQty ?? 0,
        isChecked: edits[idx]?.isChecked ?? item.isChecked ?? true,
      }));

      if (task?.taskType === 'DELIVERY_DISPATCH') {
        return apiClient.patch(`/tasks/${taskId}/dispatch`, { checklistItems: items, complete });
      }
      if (['RETURN_PUT_AWAY', 'PURCHASE_PUT_AWAY', 'EXPIRY_QUARANTINE', 'WAREHOUSE_TRANSFER'].includes(task?.taskType)) {
        return apiClient.patch(`/tasks/${taskId}/put-away`, {
          placements: items.map((i) => ({
            productId: i.productId?._id || i.productId,
            warehouseId: task.warehouseId?._id || task.warehouseId,
            zoneId: i.zoneId || task.warehouseId?.zones?.[0]?._id,
            areaId: i.areaId || task.warehouseId?.zones?.[0]?.areas?.[0]?._id,
            unitName: i.unitName,
            baseQty: i.verifiedQty,
          })),
          complete,
        });
      }
      if (task?.taskType === 'PHYSICAL_STOCK_COUNT') {
        return apiClient.patch(`/tasks/${taskId}/stock-count`, {
          counts: items.map((i) => ({
            batchId: i.batchId,
            physicalCountBaseQty: i.verifiedQty,
          })),
          complete,
        });
      }
      return complete
        ? apiClient.patch(`/tasks/${taskId}/complete`, { checklistItems: items })
        : apiClient.patch(`/tasks/${taskId}/start`, { checklistItems: items, saveAsDraft: true });
    },
    onSuccess: (_res, vars) => {
      queryClient.invalidateQueries({ queryKey: ['pending-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['task-detail', taskId] });
      addToast({ type: 'success', message: vars.complete ? 'Task closed and posted.' : 'Task draft saved.' });
      if (vars.complete) navigate('/tasks/pending');
    },
    onError: (err) => {
      addToast({ type: 'error', message: err?.response?.data?.message || 'Task action failed.' });
    },
  });

  if (taskQuery.isLoading) {
    return <div className="p-8 text-sm text-[var(--text-muted)]">Loading guided task wizard...</div>;
  }

  const checklist = task?.checklistItems || [];

  return (
    <div className="flex-1 min-h-0 flex flex-col gap-3">
      <PageHeader
        title={task?.title || 'Task Execution Wizard'}
        subtitle={`Task Code: ${task?.taskCode || ''} · Type: ${task?.taskType || ''}`}
        badge={task?.priority}
        actions={
          <>
            <button type="button" onClick={() => navigate('/tasks/pending')} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border text-xs font-medium">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Queue</span>
            </button>
            <StatusBadge status={task?.status || 'FRESH'} />
          </>
        }
      />

      <div className="flex-1 min-h-0 overflow-auto rounded-xl border bg-[var(--bg-surface)] p-4 space-y-2.5">
        {checklist.length === 0 ? (
          <div className="py-10 text-center text-sm text-[var(--text-muted)]">
            No line items on this task. You can mark it complete to close the assignment.
          </div>
        ) : (
          checklist.map((item, idx) => {
            const currentQty = edits[idx]?.verifiedQty ?? item.verifiedQty ?? item.expectedQty ?? 0;
            const checked = edits[idx]?.isChecked ?? item.isChecked ?? false;
            return (
              <div key={item._id || idx} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3 bg-[var(--bg-canvas)]">
                <label className="flex items-center gap-2.5 min-w-0 flex-1">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => setEdits((p) => ({ ...p, [idx]: { ...p[idx], isChecked: e.target.checked } }))}
                    className="w-4 h-4 accent-[var(--accent-primary)]"
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {item.itemLabel || item.productId?.productName || `Item #${idx + 1}`}
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Expected: <span className="font-mono tabular-nums">{item.expectedQty}</span> {item.unitName}
                    </p>
                  </div>
                </label>

                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    value={currentQty}
                    onChange={(e) => setEdits((p) => ({ ...p, [idx]: { ...p[idx], verifiedQty: Number(e.target.value) } }))}
                    className="w-24 h-9 px-2.5 rounded-lg border bg-[var(--bg-surface)] text-sm font-mono tabular-nums"
                  />
                  <button
                    type="button"
                    onClick={() => setKeypadTarget({ idx, val: currentQty })}
                    className="w-9 h-9 rounded-lg border bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center"
                  >
                    <Calculator className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="shrink-0 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={() => commitMutation.mutate({ complete: false })}
          disabled={commitMutation.isPending}
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg border text-xs font-semibold"
        >
          <Save className="w-4 h-4" />
          <span>Save Draft</span>
        </button>
        <button
          type="button"
          onClick={() => commitMutation.mutate({ complete: true })}
          disabled={commitMutation.isPending}
          className="inline-flex items-center gap-1.5 h-10 px-5 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold"
        >
          <CheckCircle2 className="w-4 h-4" />
          <span>Complete &amp; Close Task</span>
        </button>
      </div>

      <TouchKeypadModal
        isOpen={Boolean(keypadTarget)}
        onClose={() => setKeypadTarget(null)}
        initialValue={keypadTarget?.val ?? 0}
        title="Verify Task Quantity"
        onConfirm={(val) => {
          if (keypadTarget) {
            setEdits((p) => ({
              ...p,
              [keypadTarget.idx]: { ...p[keypadTarget.idx], verifiedQty: val, isChecked: true },
            }));
          }
        }}
      />
    </div>
  );
}
