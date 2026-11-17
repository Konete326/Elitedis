import React, { useEffect, useId, useRef, useState } from 'react';
import { Upload, X, Image as ImageIcon, RefreshCw } from 'lucide-react';
import { uploadImage } from '../../services/uploadService';

/**
 * Cloudinary ImageDropzone with local URL.createObjectURL preview,
 * cleanup revocation, and locked isSubmitting upload state.
 */
export function ImageDropzone({
  value,
  onChange,
  onUpload,
  folder = 'general',
  label = 'Upload Image',
  hint = 'PNG, JPG, or WEBP up to 5MB',
  accept = 'image/*',
  maxSizeMb = 5,
  disabled = false,
  isSubmitting = false,
  deferUpload = false,
  className = '',
}) {
  const inputId = useId();
  const inputRef = useRef(null);
  const objectUrlRef = useRef('');
  const [localPreview, setLocalPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const revokeObjectUrl = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
    }
  };

  useEffect(() => {
    return () => {
      revokeObjectUrl();
    };
  }, []);

  const currentUrl = localPreview || (typeof value === 'string' ? value : value?.url || '');
  const locked = disabled || isSubmitting || uploading;

  const processFile = async (file) => {
    if (!file || locked) return;
    setErrorMsg('');

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Please select a valid image file (PNG, JPG, WEBP).');
      return;
    }

    if (file.size > maxSizeMb * 1024 * 1024) {
      setErrorMsg(`Image exceeds ${maxSizeMb}MB limit.`);
      return;
    }

    revokeObjectUrl();
    const previewUrl = URL.createObjectURL(file);
    objectUrlRef.current = previewUrl;
    setLocalPreview(previewUrl);

    if (deferUpload) {
      onChange?.(file);
      return;
    }

    setUploading(true);
    try {
      const uploader = onUpload || uploadImage;
      const uploaded = await uploader(file, folder);
      onChange?.(uploaded);
      revokeObjectUrl();
      setLocalPreview('');
    } catch (err) {
      setErrorMsg(
        err?.response?.data?.message || err?.message || 'Image upload failed. Please try again.'
      );
    } finally {
      setUploading(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleDrop = (e) => {
    e.preventDefault();
    if (locked) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleRemove = () => {
    if (locked) return;
    revokeObjectUrl();
    setLocalPreview('');
    setErrorMsg('');
    onChange?.(null);
  };

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label
          htmlFor={inputId}
          className="block text-xs font-semibold text-[var(--text-secondary)]"
        >
          {label}
        </label>
      )}

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        className={`relative rounded-xl border border-dashed border-[var(--border-subtle)] bg-[var(--bg-elevated)]/60 p-3 transition-colors duration-200 ${
          locked ? 'opacity-70 cursor-not-allowed' : 'hover:border-[var(--accent-primary)]'
        }`}
      >
        <input
          ref={inputRef}
          id={inputId}
          type="file"
          accept={accept}
          disabled={locked}
          onChange={handleFileChange}
          className="sr-only"
        />

        {currentUrl ? (
          <div className="flex items-center gap-3">
            <img
              src={currentUrl}
              alt={label}
              className="w-16 h-16 rounded-lg object-cover border border-[var(--border-subtle)] bg-[var(--bg-surface)] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                {uploading ? 'Uploading to Cloudinary...' : 'Image ready'}
              </p>
              <p className="text-[11px] text-[var(--text-muted)] truncate">
                {value?.publicId || 'Stored preview'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => inputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] disabled:opacity-40"
                >
                  <RefreshCw className={`w-3 h-3 ${uploading ? 'animate-spin' : ''}`} />
                  <span>Replace</span>
                </button>
                <button
                  type="button"
                  disabled={locked}
                  onClick={handleRemove}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md border border-[var(--status-danger)]/30 bg-[var(--status-danger)]/10 text-xs font-medium text-[var(--status-danger)] hover:opacity-90 disabled:opacity-40"
                >
                  <X className="w-3 h-3" />
                  <span>Remove</span>
                </button>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={locked}
            onClick={() => inputRef.current?.click()}
            className="w-full py-4 flex flex-col items-center justify-center text-center gap-1.5 cursor-pointer disabled:cursor-not-allowed"
          >
            <div className="w-9 h-9 rounded-lg bg-[var(--accent-soft)] text-[var(--accent-primary)] flex items-center justify-center">
              {uploading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Upload className="w-4 h-4" strokeWidth={1.75} />
              )}
            </div>
            <p className="text-xs font-semibold text-[var(--text-primary)]">
              {uploading ? 'Uploading image...' : 'Click or drop image here'}
            </p>
            <p className="text-[11px] text-[var(--text-muted)] inline-flex items-center gap-1">
              <ImageIcon className="w-3 h-3" />
              <span>{hint}</span>
            </p>
          </button>
        )}
      </div>

      {errorMsg && <p className="text-xs text-[var(--status-danger)]">{errorMsg}</p>}
    </div>
  );
}

export default ImageDropzone;
