import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Printer, Download, FileText, Share2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
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
 * Portal-mounted (z-[100]) A4 / Landscape / Thermal print preview viewer synced
 * with distributor agencyProfile branding and mobile-first (<640px) stacked preview cards.
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
  const { agencyProfile } = useAuth();
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

  if (!active || typeof document === 'undefined') return null;

  const bp = agencyProfile?.businessProfile || {};
  const agencyTitle = templateConfig?.companyTitle || bp.companyTitle || agencyProfile?.distributorName || 'ELITE DIST Agency';
  const agencyLogo = bp.showLogo !== false ? (templateConfig?.logo?.url || bp.logo?.url || '') : '';
  const agencyPhone = bp.phonePrimary || agencyProfile?.phone || '';
  const agencyAddress = [bp.fullAddress, bp.city].filter(Boolean).join(', ');
  const agencyHeaderNote = templateConfig?.subjectLine || bp.headerNote || '';
  const agencyFooterNote = templateConfig?.footerNote || bp.footerNote || '';

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
    const text = encodeURIComponent(shareText || `${title} — ${agencyTitle}`);
    const cleanPhone = whatsappPhone.replace(/[^0-9]/g, '');
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
      className="fixed inset-0 z-[100] flex items-center justify-center p-2 sm:p-4 bg-[var(--bg-overlay)] backdrop-blur-md animate-fade-in"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-6xl h-[95dvh] sm:h-[92dvh] flex flex-col rounded-2xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-2xl overflow-hidden animate-scale-in"
      >
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2.5 px-3 sm:px-4 py-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] print:hidden">
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
              className="inline-flex items-center gap-1.5 min-h-[38px] sm:h-9 px-3 rounded-lg bg-[var(--accent-primary)] hover:bg-[var(--accent-hover)] text-white text-xs font-semibold transition"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print</span>
            </button>
            <button
              type="button"
              onClick={handlePdf}
              className="inline-flex items-center gap-1.5 min-h-[38px] sm:h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] transition"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>PDF</span>
            </button>
            <button
              type="button"
              disabled={exporting}
              onClick={handleExcelCsv}
              className="inline-flex items-center gap-1.5 min-h-[38px] sm:h-9 px-3 rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-xs font-medium text-[var(--text-primary)] disabled:opacity-50 transition"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{exporting ? 'Exporting...' : 'Excel / CSV'}</span>
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="inline-flex items-center gap-1.5 min-h-[38px] sm:h-9 px-3 rounded-lg border border-[var(--status-success)]/40 bg-[var(--status-success)]/10 text-xs font-semibold text-[var(--status-success)] hover:opacity-90 transition"
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
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 pb-3 border-b border-[var(--border-subtle)]">
              <div className="flex items-start gap-3 min-w-0">
                {agencyLogo && (
                  <img
                    src={agencyLogo}
                    alt={agencyTitle}
                    className="w-12 h-12 rounded-lg object-contain border border-[var(--border-subtle)] bg-[var(--bg-elevated)] shrink-0"
                  />
                )}
                <div className="min-w-0">
                  <p className="text-base font-bold tracking-tight truncate">{agencyTitle}</p>
                  {agencyHeaderNote && <p className="text-xs text-[var(--text-secondary)]">{agencyHeaderNote}</p>}
                  {(agencyPhone || agencyAddress || bp.ntn) && (
                    <p className="mt-0.5 text-[11px] text-[var(--text-muted)]">
                      {[agencyPhone && `Ph: ${agencyPhone}`, agencyAddress, bp.ntn && `NTN: ${bp.ntn}`].filter(Boolean).join(' · ')}
                    </p>
                  )}
                </div>
              </div>
              <div className="sm:text-right text-xs text-[var(--text-muted)] tabular-nums shrink-0">
                <p className="font-semibold text-[var(--text-primary)]">{title}</p>
                <p>{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            <div className="mt-4">
              {children || (
                <>
                  <div className="sm:hidden print:hidden space-y-2.5">
                    {rows.map((row, idx) => (
                      <div key={row._id || idx} className="rounded-lg border border-[var(--border-subtle)] bg-[var(--bg-elevated)]/40 p-3 space-y-1.5 text-xs">
                        {columns.map((col) => (
                          <div key={col.key} className="flex items-center justify-between gap-2">
                            <span className="text-[var(--text-muted)]">{col.header || col.label}</span>
                            <span className={`font-semibold text-right ${col.numeric ? 'tabular-nums font-mono' : ''}`}>
                              {typeof col.accessor === 'function' ? col.accessor(row) : row?.[col.key] ?? '—'}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>

                  <table className="hidden sm:table print:table w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-elevated)] text-left">
                        {columns.map((col) => (
                          <th key={col.key} className="px-2 py-2 font-semibold">{col.header || col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {rows.map((row, idx) => (
                        <tr key={row._id || idx}>
                          {columns.map((col) => (
                            <td key={col.key} className={`px-2 py-1.5 ${col.numeric ? 'tabular-nums font-mono' : ''}`}>
                              {typeof col.accessor === 'function' ? col.accessor(row) : row?.[col.key] ?? '—'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </>
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

            {agencyFooterNote && (
              <p className="mt-4 text-[11px] text-[var(--text-secondary)] text-center italic">
                {agencyFooterNote}
              </p>
            )}

            <div className="mt-6 pt-3 border-t border-dashed border-[var(--border-subtle)] grid grid-cols-3 gap-4 text-[11px] text-[var(--text-muted)]">
              <span>Prepared By: ____________</span>
              <span className="text-center">Checked By: ____________</span>
              <span className="text-right">Receiver Sign: ____________</span>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default PrintPreviewModal;
