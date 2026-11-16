import sharp from 'sharp';
import { HttpError } from '../shared/http.mjs';

const maxBytes = 2 * 1024 * 1024;
const maxPixels = 16_000_000;
let processing = 0;

// Giải mã và encode lại: loại metadata mặc định của sharp, tự xoay theo EXIF.
// Chặn pixel flood trước giải mã; chỉ xử lý hai ảnh cùng lúc trong một process.
export async function decodePhoto(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') throw new HttpError(400, 'Hình ảnh không hợp lệ.');
  if (raw.length > Math.ceil(maxBytes / 3) * 4 + 64) throw new HttpError(413, 'Ảnh phải nhỏ hơn 2 MB.');
  const match = raw.match(/^data:image\/(png|jpeg|webp);base64,([A-Za-z0-9+/]+={0,2})$/);
  if (!match) throw new HttpError(400, 'Chỉ hỗ trợ ảnh PNG, JPG hoặc WebP.');
  const input = Buffer.from(match[2], 'base64');
  if (input.length < 16 || input.length > maxBytes) throw new HttpError(413, 'Ảnh phải nhỏ hơn 2 MB.');
  if (processing >= 2) throw new HttpError(503, 'Xử lý ảnh đang bận. Vui lòng thử lại.');
  processing++;
  try {
    const image = sharp(input, { limitInputPixels: maxPixels, failOn: 'warning', sequentialRead: true });
    const metadata = await image.metadata();
    if (metadata.format !== match[1]) throw new HttpError(400, 'Định dạng ảnh không khớp nội dung.');
    if (!metadata.width || !metadata.height || metadata.width > 8192 || metadata.height > 8192
      || metadata.width * metadata.height > maxPixels || (metadata.pages || 1) > 1) {
      throw new HttpError(413, 'Ảnh tối đa 16 triệu điểm ảnh, mỗi cạnh tối đa 8192 pixel và không phải ảnh động.');
    }
    const bytes = await image.rotate().toFormat(match[1]).toBuffer();
    if (bytes.length > maxBytes) throw new HttpError(413, 'Ảnh sau xử lý vượt quá 2 MB.');
    return { bytes, ext: match[1] === 'jpeg' ? 'jpg' : match[1] };
  } catch (error) {
    if (error instanceof HttpError) throw error;
    if (/pixel limit/i.test(error.message)) throw new HttpError(413, 'Ảnh vượt quá giới hạn 16 triệu điểm ảnh.');
    throw new HttpError(400, 'Không đọc được ảnh hoặc ảnh vượt giới hạn điểm ảnh.');
  } finally { processing--; }
}
