import apiClient from './apiClient';

/**
 * Upload an image file to Cloudinary via the Express `/upload/image` endpoint.
 * @param {File} file
 * @param {string} folder
 * @returns {Promise<{ url: string, publicId: string }>}
 */
export async function uploadImage(file, folder = 'general') {
  if (!file) {
    throw new Error('No image file selected for upload.');
  }

  const formData = new FormData();
  formData.append('image', file);
  formData.append('folder', folder);

  const response = await apiClient.post('/upload/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });

  const payload = response.data?.data || response.data;
  return {
    url: payload?.url || payload?.secure_url || '',
    publicId: payload?.publicId || payload?.public_id || '',
  };
}

/**
 * Remove an orphaned or replaced Cloudinary image by its publicId.
 * @param {string} publicId
 */
export async function deleteImage(publicId) {
  if (!publicId) return null;
  const response = await apiClient.delete('/upload/image', {
    data: { publicId },
  });
  return response.data;
}

export default {
  uploadImage,
  deleteImage,
};
