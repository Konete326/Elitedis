import { v2 as cloudinary } from 'cloudinary';
import { env } from './env.js';

cloudinary.config({
  cloud_name: env.CLOUDINARY_CLOUD_NAME,
  api_key: env.CLOUDINARY_API_KEY,
  api_secret: env.CLOUDINARY_API_SECRET,
  secure: true,
});

const PLACEHOLDER_TOKENS = ['your_cloudinary_', 'demo_elite_dist', 'demo_cloudinary_'];

/**
 * Checks whether non-placeholder Cloudinary credentials are configured.
 */
export function isCloudinaryConfigured() {
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = env;
  const values = [CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET];
  return values.every((val) => val && !PLACEHOLDER_TOKENS.some((prefix) => val.startsWith(prefix)));
}

/**
 * Resolves a sanitized Cloudinary folder path rooted under CLOUDINARY_ROOT_FOLDER.
 */
export function resolveCloudinaryFolder(folder = 'general') {
  const cleanSub = String(folder || 'general')
    .replace(/[^a-zA-Z0-9/_-]/g, '')
    .replace(/^\/+|\/+$/g, '');
  const root = env.CLOUDINARY_ROOT_FOLDER.replace(/^\/+|\/+$/g, '');
  if (!cleanSub) return root;
  return cleanSub.startsWith(`${root}/`) || cleanSub === root ? cleanSub : `${root}/${cleanSub}`;
}

/**
 * Streams an in-memory image buffer directly to Cloudinary and returns secure metadata.
 */
export function uploadImageBuffer(buffer, folder = 'general', options = {}) {
  if (!buffer || !Buffer.isBuffer(buffer) || buffer.length === 0) {
    return Promise.reject(new Error('Image buffer is empty or invalid.'));
  }

  const targetFolder = resolveCloudinaryFolder(folder);

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: targetFolder,
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }],
        ...options,
      },
      (error, result) => {
        if (error) {
          reject(new Error(`Cloudinary upload failed: ${error.message}`));
          return;
        }
        resolve({
          url: result.secure_url,
          publicId: result.public_id,
          width: result.width,
          height: result.height,
          format: result.format,
          bytes: result.bytes,
        });
      }
    );

    uploadStream.end(buffer);
  });
}

/**
 * Deletes an asset from Cloudinary by publicId to prevent orphaned cloud storage.
 */
export async function destroyImage(publicId) {
  if (!publicId || typeof publicId !== 'string') {
    return { result: 'skipped' };
  }
  return cloudinary.uploader.destroy(publicId, { invalidate: true });
}

export { cloudinary };
export default cloudinary;
