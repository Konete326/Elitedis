import React, { useEffect, useState } from 'react';
import { X, Printer, Download, FileText, Share2 } from 'lucide-react';
import { useShell } from '../../context/ShellContext';

const FORMAT_WIDTHS = {
  a4: 'max-w-3xl',
  landscape: 'max-w-5xl',
  thermal: 'max-w-xs font-mono',
};

function escapeCsvCell(val) {
  const str = String(val ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

async function exportRowsToCsvChunked(filename, columns, rows) {
  const headers = columns.map((c) => escapeCsvCell(c.header || c.label || c.key)).join(',');
  const chunks = [headers];
  const batchSize = 200;

  for (let i = 0; i < rows.length; i += batchSize) {
    const slice = rows.slice(i, i + batchSize);
    for (const row of slice) {
      chunks.push(
        columns
          .map((col) => escapeCsvCell(typeof col.accessor === 'function' ? col.accessor(row) : row?.[col.key]))
          .join(',')
      );
    }
    if (i + batchSize < rows.length) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
    }
  }

  const blob = new Blob([chunks.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename || 'elitedist-report'}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * z-50 A4 / Landscape / Thermal printable invoice, chillan, dispatch, and report viewer
 * with Print, PDF, Excel/CSV, and WhatsApp share controls.
 */
export function PrintPreviewModal({
  isOpen,
  open,
  onClose,
  title = 'Document Preview',
  subtitle = '',
  documentType = 'A4 Document',
  defaultFormat = 'a4',
  layoutMode,
  templateConfig,
  columns = [],
  rows = [],
  summaryRows = [],
  shareText,
  whatsappPhone = '',
  onPrint,
  onExportPdf,
  onExportExcel,
  onExportCsv,
  onShareWhatsApp,
  children,
}) {
  const active = isOpen ?? open ?? false;
  const { lockScroll, unlockScroll, addToast } = useShell();
  const [format, setFormat] = useState(layoutMode || defaultFormat || 'a4');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!active) return undefined;
    setFormat(layoutMode || defaultFormat || 'a4');
    lockScroll?.();
    return () => unlockScroll?.();
  }, [active, layoutMode, defaultFormat, lockScroll, unlockScroll]);

  useEffect(() => {
    if (!active) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [active, onClose]);

  if (!active) return null;

  const handlePrint = () => (onPrint ? onPrint(format) : window.print());
  const handlePdf = () => (onExportPdf ? onExportPdf(format) : window.print());

  const handleExcelCsv = async () => {
    if (onExportExcel) return onExportExcel(format);
    if (onExportCsv) return onExportCsv(format);
    if (!columns.length) {
      addToast?.({ type: 'info', message: 'Use Print or Save as PDF for this layout.' });
      return;
    }
    setExporting(true);
    try {
      await exportRowsToCsvChunked(title.toLowerCase().replace(/\s+/g, '-'), columns, rows);
      addToast?.({ type: 'success', message: 'CSV report exported.' });
    } finally {
      setExporting(false);
    }
  };

  const handleWhatsApp = () => {
    if (onShareWhatsApp) return onShareWhatsApp(format);
    const text = encodeURIComponent(shareText || `${title} — ELITE DIST ERP`);
    const cleanPhone = whatsappPhone.replace(/[^0-9]/g, '');
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-[var(--bg-overlay)] backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl h-[92dvh] flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden"
      >
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5 px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm sm:text-base font-bold text-[var(--text-primary)] truncate">{title}</h2>
              <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[var(--accent-soft)] text-[var(--accent-primary)]">
                {documentType}
              </span>
            </div>
            {subtitle && <p className="text-xs text-[var(--text-muted)] truncate">{subtitle}</p>}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <div className="inline-flex rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)] p-0.5 text-xs">
              {[
                { id: 'a4', label: 'A4' },
                { id: 'landscape', label: 'Landscape' },
                { id: 'thermal', label: '80mm POS' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setFormat(opt.id)}
                  className={`px-2.5 py-1 rounded-md font-medium transition ${
                    format === opt.id
                      ? 'bg-[var(--bg-surface)] text-[var(--accent-primary)] shadow-sm'
                      : 'text-[var(--text-secondary)]'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={handlePdf}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] transition"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={handleExcelCsv}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] disabled:opacity-50 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting...' : 'Excel / CSV'}</span>
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-[var(--status-success)]/40 bg-[var(--status-success)]/10 text-xs font-semibold text-[var(--status-success)] hover:opacity-90 transition"
            >
              <Share2 className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close print preview"
              className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-auto bg-[var(--bg-canvas)] p-3 sm:p-6">
          <div
            className={`mx-auto w-full ${
              FORMAT_WIDTHS[format] || FORMAT_WIDTHS.a4
            } rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] shadow-sm p-4 sm:p-6`}
          >
            <div className="flex items-start justify-between gap-4 pb-3 border-b border-[var(--border-subtle)]">
              <div>
                <p className="text-base font-bold tracking-tight">
                  {templateConfig?.companyTitle || 'ELITE DIST Agency'}
                </p>
                {templateConfig?.subjectLine && (
                  <p className="text-xs text-[var(--text-secondary)]">{templateConfig.subjectLine}</p>
                )}
              </div>
              <div className="text-right text-xs text-[var(--text-muted)] tabular-nums">
                <p className="font-semibold text-[var(--text-primary)]">{title}</p>
                <p>{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mt-4">
              {children || (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-left">
                      {columns.map((col) => (
                        <th key={col.key} className="px-2 py-2 font-semibold">
                          {col.header || col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-subtle)]">
                    {rows.map((row, idx) => (
                      <tr key={row._id || idx}>
                        {columns.map((col) => (
                          <td
                            key={col.key}
                            className={`px-2 py-1.5 ${col.numeric ? 'tabular-nums font-mono' : ''}`}
                          >
                            {typeof col.accessor === 'function' ? col.accessor(row) : row?.[col.key] ?? '—'}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {summaryRows.length > 0 && (
              <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex flex-col items-end gap-1 text-xs">
                {summaryRows.map((item) => (
                  <div key={item.label} className="flex items-center gap-6">
                    <span className="text-[var(--text-secondary)]">{item.label}:</span>
                    <span className="font-bold font-mono tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-6 pt-3 border-t border-dashed border-[var(--border-subtle)] grid grid-cols-3 gap-4 text-[11px] text-[var(--text-muted)]">
              <span>Prepared By: ____________</span>
              <span className="text-center">Checked By: ____________</span>
              <span className="text-right">Receiver Sign: ____________</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PrintPreviewModal;
