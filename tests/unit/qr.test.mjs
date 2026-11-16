import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { giftQrDataUrl } from '../../web/js/features/gifts/qr.js';

test('QR cục bộ giải mã được đúng link, không cần yêu cầu mạng', async () => {
  const link='https://momevia.example/g/AbCdEf0123456789_-secret';
  const image=giftQrDataUrl(link);
  assert(image.startsWith('data:image/gif;base64,'));
  const {data,info}=await sharp(Buffer.from(image.split(',')[1],'base64')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const result=jsQR(new Uint8ClampedArray(data),info.width,info.height);
  assert.equal(result?.data,link);
});
