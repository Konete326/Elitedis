import multer from 'multer';
import { AppError } from './errorMiddleware.js';

const ALLOWED_IMAGE_MIMES = new Set([
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
]);

const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.memoryStorage();

function imageFileFilter(_req, file, cb) {
  if (!file || !ALLOWED_IMAGE_MIMES.has(file.mimetype)) {
    cb(new AppError('Only JPG, PNG, WEBP, GIF, and AVIF image files are allowed.', 400, 'INVALID_FILE_TYPE'));
    return;
  }
  cb(null, true);
}

export const multerImageUpload = multer({
  storage,
  limits: {
    fileSize: MAX_IMAGE_SIZE_BYTES,
    files: 5,
  },
  fileFilter: imageFileFilter,
});

/**
 * Middleware factory for uploading a single image file into memory buffer.
 */
export function uploadSingleImage(fieldName = 'image') {
  return multerImageUpload.single(fieldName);
}

/**
 * Middleware factory for uploading multiple image files into memory buffers.
 */
export function uploadMultipleImages(fieldName = 'images', maxCount = 5) {
  return multerImageUpload.array(fieldName, maxCount);
}

export const uploadImageMiddleware = uploadSingleImage('image');

export default uploadImageMiddleware;
