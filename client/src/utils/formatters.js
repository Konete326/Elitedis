export function formatCurrency(value, showSymbol = true) {
  const num = Number(value) || 0;
  const formatted = num.toLocaleString('en-PK', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return showSymbol ? `PKR ${formatted}` : formatted;
}

export function formatNumber(value, decimals = 0) {
  const num = Number(value) || 0;
  return num.toLocaleString('en-PK', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatWeight(kg) {
  const num = Number(kg) || 0;
  return `${num.toFixed(3)} Kg`;
}

export function formatDualUnit(baseQty, conversionQty = 1, packName = 'CT', baseName = 'Pcs') {
  const qty = Math.max(0, Number(baseQty) || 0);
  const conv = Math.max(1, Number(conversionQty) || 1);
  if (conv <= 1) {
    return `${qty} ${baseName}`;
  }
  const packs = Math.floor(qty / conv);
  const rem = qty % conv;
  return `${packs} ${packName} : ${rem} ${baseName}`;
}

export function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

export function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

const TONE_MAP = {
  ACTIVE: 'success',
  AVAILABLE: 'success',
  APPROVED: 'success',
  COMPLETED: 'success',
  COMPLETE: 'success',
  PAID: 'success',
  PAID_CASH: 'success',
  NORMAL: 'success',
  PRESENT: 'success',
  CLEARED: 'success',
  ACCEPT: 'success',
  PENDING: 'warning',
  RESERVED: 'warning',
  LOW_WARNING: 'warning',
  DRAFT: 'warning',
  PARTIAL: 'warning',
  FRESH: 'info',
  DELIVERY_ASSIGNED: 'info',
  VISITED: 'info',
  ORDERED: 'info',
  DELIVERED: 'success',
  ALLOW_CREDIT: 'info',
  ADVANCE: 'info',
  URGENT: 'danger',
  INACTIVE: 'muted',
  BLOCKED: 'danger',
  OUT: 'danger',
  CANCELLED: 'danger',
  EXPIRED: 'danger',
  EXPIRE: 'danger',
  DAMAGE: 'danger',
  DAMAGE_EXPIRE: 'danger',
  QUARANTINED: 'danger',
  OVERDUE: 'danger',
  ABSENT: 'danger',
  BOUNCED: 'danger',
  NON_ACCEPT: 'muted',
};

export function getStatusTone(status) {
  const key = String(status || '').toUpperCase().trim();
  return TONE_MAP[key] || 'info';
}

export function extractListPayload(response) {
  const body = response?.data || {};
  const data = Array.isArray(body.data)
    ? body.data
    : Array.isArray(body.items)
      ? body.items
      : Array.isArray(body)
        ? body
        : [];
  const pagination = body.pagination || {
    totalRecords: data.length,
    currentPage: 1,
    totalPages: 1,
    pageSize: data.length || Number(import.meta.env.VITE_DEFAULT_PAGE_SIZE) || 10,
    hasNextPage: false,
    hasPrevPage: false,
  };
  const summary = body.summary || body.meta || {};
  return { data, pagination, summary };
}
