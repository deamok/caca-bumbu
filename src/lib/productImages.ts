import { getSupabase } from './supabase';

export const PRODUCT_IMAGE_BUCKET = 'product-images';
const MAX_INPUT_BYTES = 8 * 1024 * 1024;
const STORAGE_MARKER = `/storage/v1/object/public/${PRODUCT_IMAGE_BUCKET}/`;

export class ProductImageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProductImageError';
  }
}

type ImageSource = ImageBitmap | HTMLImageElement;

async function loadImageSource(file: File): Promise<ImageSource> {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // HEIC atau format yang tidak didukung createImageBitmap: coba lewat <img>.
    }
  }
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new ProductImageError('Foto tidak bisa dibaca. Coba format JPG atau PNG.'));
    };
    image.src = url;
  });
}

/** Perkecil & kompres foto di HP sebelum diunggah. */
export async function compressProductImage(
  file: File,
  maxSize = 1200,
  quality = 0.82,
): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new ProductImageError('File yang dipilih bukan gambar.');
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new ProductImageError('Ukuran foto terlalu besar. Maksimal 8 MB.');
  }

  const source = await loadImageSource(file);
  const width = source.width;
  const height = source.height;
  if (!width || !height) throw new ProductImageError('Foto tidak bisa dibaca.');

  const scale = Math.min(1, maxSize / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));

  const context = canvas.getContext('2d');
  if (!context) throw new ProductImageError('Browser tidak bisa mengolah foto ini.');
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source as CanvasImageSource, 0, 0, canvas.width, canvas.height);
  if ('close' in source && typeof source.close === 'function') source.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
  if (!blob) throw new ProductImageError('Foto gagal dikompres.');
  return blob;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(new ProductImageError('Foto gagal dibaca.'));
    reader.readAsDataURL(blob);
  });
}

/** Ambil path objek storage dari URL publik (null bila bukan foto dari bucket ini). */
export function storagePathFromUrl(url: string): string | null {
  if (!url) return null;
  const index = url.indexOf(STORAGE_MARKER);
  if (index < 0) return null;
  const rest = url.slice(index + STORAGE_MARKER.length).split('?')[0];
  try {
    return decodeURIComponent(rest);
  } catch {
    return rest;
  }
}

async function uploadToStorage(userId: string, productId: string, blob: Blob): Promise<string> {
  const client = await getSupabase();
  const path = `${userId}/${productId}-${Date.now()}.jpg`;
  const { error } = await client.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000', upsert: false });
  if (error) throw new ProductImageError(`Foto gagal diunggah: ${error.message}`);

  const { data } = client.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(path);
  return `${data.publicUrl}?v=${Date.now()}`;
}

/**
 * Simpan foto produk. Saat masuk akun → Supabase Storage (URL publik, tampil di
 * katalog). Tanpa akun → data URL kecil di perangkat agar tetap bisa luring.
 */
export async function saveProductImage(options: {
  file: File;
  productId: string;
  userId: string | null;
}): Promise<string> {
  if (options.userId) {
    const blob = await compressProductImage(options.file, 1200, 0.82);
    return uploadToStorage(options.userId, options.productId, blob);
  }
  const blob = await compressProductImage(options.file, 560, 0.72);
  return blobToDataUrl(blob);
}

/** Hapus foto lama dari storage (abaikan bila bukan milik bucket ini). */
export async function deleteProductImage(url: string): Promise<void> {
  const path = storagePathFromUrl(url);
  if (!path) return;
  try {
    const client = await getSupabase();
    await client.storage.from(PRODUCT_IMAGE_BUCKET).remove([path]);
  } catch {
    // Foto yatim tidak mengganggu; biarkan saja bila gagal dihapus.
  }
}
