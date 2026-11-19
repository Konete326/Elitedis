import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { extractRowImages } from '../global/SmartMediaCard';

/**
 * Full-image (object-contain) product card media header with conditional slider (>1 image only).
 */
export default function ProductCardMedia({ product, fallbackIcon: FallbackIcon }) {
  const images = extractRowImages(product);
  const [imgIdx, setImgIdx] = useState(0);
  const safeIdx = imgIdx < images.length ? imgIdx : 0;

  const stepImage = (e, delta) => {
    e.stopPropagation();
    if (images.length <= 1) return;
    setImgIdx((prev) => (prev + delta + images.length) % images.length);
  };

  return (
    <div className="relative h-32 sm:h-36 w-full bg-[var(--bg-elevated)] overflow-hidden border-b border-[var(--border-subtle)]">
      {images.length > 0 ? (
        <img
          src={images[safeIdx]}
          alt={product.productName}
          loading="lazy"
          className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="h-full w-full flex items-center justify-center text-[var(--accent-primary)]/40">
          {FallbackIcon && <FallbackIcon className="w-8 h-8" />}
        </div>
      )}

      <span className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-[var(--bg-surface)]/90 text-[var(--text-primary)] border border-[var(--border-subtle)] backdrop-blur-sm">
        Stock {product.availableBaseQty ?? 0}
      </span>

      {images.length > 1 && (
        <>
          <div className="absolute inset-y-0 inset-x-1.5 flex items-center justify-between opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
            <button
              type="button"
              onClick={(e) => stepImage(e, -1)}
              aria-label="Previous product image"
              className="w-7 h-7 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => stepImage(e, 1)}
              aria-label="Next product image"
              className="w-7 h-7 rounded-full bg-black/45 hover:bg-black/65 text-white flex items-center justify-center"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div
            className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1 px-1.5 py-0.5 rounded-full bg-black/45 backdrop-blur-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`View product image ${i + 1}`}
                onClick={() => setImgIdx(i)}
                className={`h-1.5 rounded-full transition-all ${safeIdx === i ? 'w-3.5 bg-white' : 'w-1.5 bg-white/55'}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
