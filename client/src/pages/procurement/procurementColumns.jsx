import StatusBadge from '../../components/shared/StatusBadge';
import { formatCurrency, formatDateTime } from '../../utils/formatters';

export const ORDER_COLUMNS = [
  { key: 'code', header: 'PO / Ref', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.movementCode || '—'}</span> },
  { key: 'supplier', header: 'Supplier', mobilePrimary: true, accessor: (r) => r.supplierCompanyId?.companyName || 'Unassigned Supplier' },
  { key: 'warehouse', header: 'Warehouse', accessor: (r) => r.toWarehouseId?.warehouseName || '—' },
  { key: 'taskName', header: 'Reference', accessor: (r) => r.taskName || 'Purchase Order' },
  {
    key: 'value',
    header: 'Value',
    numeric: true,
    align: 'right',
    accessor: (r) =>
      formatCurrency(
        r.totalAmountPkr ?? (r.items || []).reduce((s, i) => s + (Number(i.totalValuePkr) || 0), 0)
      ),
  },
  { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status} /> },
  { key: 'createdAt', header: 'Created', accessor: (r) => formatDateTime(r.createdAt) },
];

export const PAYMENT_COLUMNS = [
  { key: 'voucherNo', header: 'Voucher', numeric: true, render: (r) => <span className="font-mono font-semibold">{r.voucherNo}</span> },
  { key: 'narration', header: 'Description', mobilePrimary: true, accessor: (r) => r.narration || 'Supplier Payment' },
  { key: 'debitPkr', header: 'Paid Amount', numeric: true, align: 'right', accessor: (r) => formatCurrency(r.debitPkr || 0) },
  { key: 'status', header: 'Status', mobileBadge: true, render: (r) => <StatusBadge status={r.status || 'APPROVED'} /> },
  { key: 'transactionDate', header: 'Posted', accessor: (r) => formatDateTime(r.transactionDate || r.createdAt) },
];
