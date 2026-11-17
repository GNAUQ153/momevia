import { createHmac, timingSafeEqual } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';

const hmac = (key, content) => createHmac('sha256', key).update(content).digest('hex');
function equalHex(a, b) {
  if (typeof a !== 'string' || !/^[a-f0-9]{64}$/i.test(a)) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

// PayOS SDK handles the provider-specific canonical signature format and webhook validation.
export function createPayOsProvider(env = process.env) {
  const { PAYOS_CLIENT_ID: clientId, PAYOS_API_KEY: apiKey, PAYOS_CHECKSUM_KEY: checksumKey } = env;
  if (![clientId, apiKey, checksumKey].every(x => typeof x === 'string' && x.length >= 8))
    throw new HttpError(503, 'Chưa cấu hình kênh payOS merchant.');
  let sdk;
  async function instance() {
    if (!sdk) {
      let PayOS;
      try { ({ PayOS } = await import('@payos/node')); }
      catch { throw new HttpError(503, 'Cần cài npm package @payos/node cho thanh toán payOS.'); }
      sdk = new PayOS({ clientId, apiKey, checksumKey });
    }
    return sdk;
  }
  return {
    async create({ code, amount, description, returnUrl, cancelUrl }) {
      const result = await (await instance()).paymentRequests.create({
        orderCode: Number(code), amount, description, returnUrl, cancelUrl,
      });
      if (!result?.checkoutUrl || !result?.paymentLinkId) throw new Error('payOS không trả đường dẫn thanh toán hợp lệ.');
      const url = new URL(result.checkoutUrl);
      if (url.protocol !== 'https:' || url.hostname !== 'pay.payos.vn') throw new Error('payOS checkout URL không hợp lệ.');
      return { checkoutUrl: url.href, qrPayload: result.qrCode || '', providerPaymentId: result.paymentLinkId };
    },
    async verifyWebhook(body) {
      const data = await (await instance()).webhooks.verify(body);
      if (!data?.orderCode || !Number.isSafeInteger(Number(data.amount))) throw new HttpError(400, 'payOS webhook thiếu thông tin.');
      return {
        code: String(data.orderCode), amount: Number(data.amount),
        reference: String(data.reference || data.paymentLinkId || ''),
        currency: data.currency || 'VND', provider: 'payos',
        success: body.success === true && body.code === '00' && data.code === '00',
      };
    },
  };
}

// MoMo v2 captureWallet API, merchant must configure partner credentials and a PUBLIC HTTPS IPN URL.
export function createMomoProvider(env = process.env, http = fetch) {
  const { MOMO_PARTNER_CODE: partnerCode, MOMO_ACCESS_KEY: accessKey, MOMO_SECRET_KEY: secretKey } = env;
  if (![partnerCode, accessKey, secretKey].every(x => typeof x === 'string' && x.length >= 4))
    throw new HttpError(503, 'Chưa cấu hình merchant MoMo.');
  const production = env.PAYMENT_ENV === 'production';
  const endpoint = production ? 'https://payment.momo.vn/v2/gateway/api/create'
    : 'https://test-payment.momo.vn/v2/gateway/api/create';
  return {
    async create({ code, amount, description, returnUrl, ipnUrl }) {
      const requestId = code;
      const data = {
        partnerCode, accessKey, requestId, amount, orderId: code, orderInfo: description,
        redirectUrl: returnUrl, ipnUrl, requestType: 'captureWallet', extraData: '', lang: 'vi',
      };
      const raw = `accessKey=${accessKey}&amount=${amount}&extraData=&ipnUrl=${ipnUrl}`+
        `&orderId=${code}&orderInfo=${description}&partnerCode=${partnerCode}`+
        `&redirectUrl=${returnUrl}&requestId=${requestId}&requestType=captureWallet`;
      const response = await http(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ ...data, signature: hmac(secretKey, raw) }),
        signal: AbortSignal.timeout(30_000),
      });
      const result = await response.json();
      if (!response.ok || result.resultCode !== 0 || !result.payUrl) throw new HttpError(502, 'MoMo không tạo được giao dịch.');
      const url = new URL(result.payUrl);
      if (url.protocol !== 'https:' || !/(^|\.)momo\.vn$/.test(url.hostname)) throw new Error('MoMo URL không hợp lệ.');
      return { checkoutUrl: url.href, qrPayload: result.qrCodeUrl || '', providerPaymentId: String(result.requestId || code) };
    },
    async verifyWebhook(body) {
      if (body.partnerCode !== partnerCode || !body.signature) throw new HttpError(400, 'MoMo IPN không hợp lệ.');
      const fields = ['accessKey','amount','extraData','message','orderId','orderInfo','orderType','partnerCode',
        'payType','requestId','responseTime','resultCode','transId'];
      const values = { ...body, accessKey };
      if (fields.some(k => values[k] === undefined || values[k] === null)) throw new HttpError(400, 'MoMo IPN thiếu trường.');
      const payload = fields.map(k => `${k}=${values[k]}`).join('&');
      if (!equalHex(hmac(secretKey, payload), body.signature)) throw new HttpError(400, 'MoMo IPN sai chữ ký.');
      return {
        code: String(body.orderId), amount: Number(body.amount),
        reference: String(body.transId), currency: 'VND', provider: 'momo',
        success: Number(body.resultCode) === 0,
      };
    },
  };
}
