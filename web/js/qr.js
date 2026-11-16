import qrcode from './vendor/qrcode.js';

qrcode.stringToBytes = value => Array.from(new TextEncoder().encode(value));

export function giftQrDataUrl(link) {
  const qr = qrcode(0, 'M');
  qr.addData(link, 'Byte');
  qr.make();
  return qr.createDataURL(6, 24);
}
