import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function extractRowImages(row) {
  if (!row || typeof row !== 'object') return [];
  const urls = [];
  const push = (u) => {
    if (u && typeof u === 'string' && !urls.includes(u)) urls.push(u);
  };
  push(row.baseUnit?.image?.url);
  if (Array.isArray(row.packingUnits)) {
    row.packingUnits.forEach((p) => push(p?.image?.url));
  }
  push(row.productId?.baseUnit?.image?.url);
  if (Array.isArray(row.productId?.packingUnits)) {
    row.productId.packingUnits.forEach((p) => push(p?.image?.url));
  }
  push(row.image?.url);
  push(row.logo?.url);
  push(row.photo?.url);
  push(row.avatar?.url);
  if (Array.isArray(row.images)) {
    row.images.forEach((img) => push(typeof img === 'string' ? img : img?.url));
  }
  return urls;
}

export default function SmartMediaCard({
  row,
  rIdx,
  id,
  selected,
  selectable,
  toggleSelectOne,
  onRowClick,
  primaryCol,
  badgeCol,
  detailCols,
  getCellValue,
  renderActions,
}) {
  const images = extractRowImages(row);
  const [imgIdx, setImgIdx] = useState(0);
  const safeIdx = imgIdx < images.length ? imgIdx : 0;
  const tagText = row?.skuCode || row?.companyCode || row?.brandCode || row?.customerCode || row?.batchNo || '';

  const stepImage = (e, delta) => {
    e.stopPropagation();
    if (images.length <= 1) return;
    setImgIdx((prev) => (prev + delta + images.length) % images.length);
  };

  return (
    <div
      onClick={onRowClick ? () => onRowClick(row) : undefined}
      className={`animate-fade-in group overflow-hidden rounded-2xl border transition-all duration-150 flex flex-col justify-between ${
        selected
          ? 'border-[var(--accent-primary)] bg-[var(--accent-soft)]/30 shadow-md'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--accent-primary)]/50 hover:shadow-md'
      } ${onRowClick ? 'cursor-pointer' : ''}`}
    >
      {images.length > 0 && (
        <div className="relative h-48 sm:h-52 w-full overflow-hidden bg-[var(--bg-elevated)] border-b border-[var(--border-subtle)]">
          <img
            src={images[safeIdx]}
            alt={row?.productName || row?.companyName || row?.brandName || row?.shopName || 'Item'}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/45 to-transparent" />

          {tagText && (
            <span className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-[var(--bg-surface)]/85 text-[var(--text-primary)] border border-[var(--border-subtle)] backdrop-blur-sm">
              {tagText}
            </span>
          )}

          {badgeCol && (
            <div className="absolute top-2.5 right-2.5 rounded-full bg-[var(--bg-surface)]/85 backdrop-blur-sm p-0.5 shadow-sm">
              {getCellValue(row, badgeCol, rIdx)}
            </div>
          )}

          {selectable && (
            <div className="absolute bottom-2.5 left-2.5" onClick={(e) => e.stopPropagation()}>
              <input
                type="checkbox"
                aria-label={`Select row ${id}`}
                checked={selected}
                onChange={() => toggleSelectOne(id)}
                className="w-4 h-4 rounded accent-[var(--accent-primary)]"
              />
            </div>
          )}

          {images.length > 1 && (
            <>
              <div className="absolute inset-y-0 inset-x-2 flex items-center justify-between opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                <button
                  type="button"
                  onClick={(e) => stepImage(e, -1)}
                  aria-label="Previous image"
                  className="w-8 h-8 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={(e) => stepImage(e, 1)}
                  aria-label="Next image"
                  className="w-8 h-8 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`View image ${i + 1}`}
                    onClick={() => setImgIdx(i)}
                    className={`h-1.5 rounded-full transition-all ${safeIdx === i ? 'w-4 bg-white' : 'w-1.5 bg-white/55'}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
      )}

      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          <div className={`flex items-start justify-between gap-2.5 ${images.length === 0 ? 'pb-2.5 border-b border-[var(--border-subtle)]' : 'pb-2'}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              {selectable && images.length === 0 && (
                <input
                  type="checkbox"
                  aria-label={`Select row ${id}`}
                  checked={selected}
                  onClick={(e) => e.stopPropagation()}
                  onChange={() => toggleSelectOne(id)}
                  className="w-4 h-4 shrink-0 rounded accent-[var(--accent-primary)]"
                />
              )}
              <div className="min-w-0 font-semibold text-sm text-[var(--text-primary)] truncate">
                {primaryCol ? getCellValue(row, primaryCol, rIdx) : id}
              </div>
            </div>
            {badgeCol && images.length === 0 && <div className="shrink-0">{getCellValue(row, badgeCol, rIdx)}</div>}
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            {detailCols.slice(0, 6).map((col) => (
              <div key={col.key} className="min-w-0">
                <span className="block text-[11px] font-medium text-[var(--text-muted)] truncate">
                  {col.header || col.label}
                </span>
                <span className={`mt-0.5 block font-semibold text-[var(--text-primary)] truncate ${col.numeric ? 'tabular-nums font-mono' : ''}`}>
                  {getCellValue(row, col, rIdx)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {renderActions && (
          <div
            className="mt-3 pt-3 border-t border-[var(--border-subtle)] flex flex-wrap items-center justify-end gap-2 [&>button]:min-h-[44px] [&>a]:min-h-[44px]"
            onClick={(e) => e.stopPropagation()}
          >
            {renderActions(row, rIdx)}
          </div>
        )}
      </div>
    </div>
  );
}
