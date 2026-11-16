import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { decodePhoto } from '../services/gifts/photo.mjs';

const dataUrl = (bytes, format='jpeg') => `data:image/${format};base64,${bytes.toString('base64')}`;
test('Ảnh được encode lại và bỏ EXIF, kể cả GPS', async () => {
  const input = await sharp({create:{width:2,height:3,channels:3,background:'red'}})
    .jpeg().withExif({ IFD0:{Artist:'Private Author'}, IFD3:{GPSLatitudeRef:'N',GPSLatitude:'10/1 0/1 0/1'} }).toBuffer();
  assert((await sharp(input).metadata()).exif);
  const photo=await decodePhoto(dataUrl(input));
  const meta=await sharp(photo.bytes).metadata();
  assert.equal(meta.exif,undefined);
  assert.equal(meta.width,2);
  assert.equal(meta.height,3);
});
test('Chặn pixel flood, dữ liệu giả định dạng, file hỏng và dung lượng lớn', async () => {
  const oversized=await sharp({create:{width:4001,height:4000,channels:3,background:'white'}}).png().toBuffer();
  await assert.rejects(()=>decodePhoto(dataUrl(oversized,'png')), {status:413});
  const png=await sharp({create:{width:1,height:1,channels:3,background:'white'}}).png().toBuffer();
  await assert.rejects(()=>decodePhoto(dataUrl(png,'jpeg')), {status:400});
  await assert.rejects(()=>decodePhoto(dataUrl(Buffer.alloc(24))), {status:400});
  await assert.rejects(()=>decodePhoto(dataUrl(Buffer.alloc(2*1024*1024+1))), {status:413});
});
