import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';

const hmac = (key, content) => createHmac('sha256', key).update(content).digest('hex');
function equalHex(a, b) {
  if (typeof a !== 'string' || !/^[a-f0-9]{64}$/i.test(a)) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

// A payment-link state is provider-owned evidence; never trust a browser redirect.
export function parsePayOsInquiry(result, { code, amount, providerPaymentId }) {
  if (String(result?.orderCode) !== String(code) || Number(result?.amount) !== amount
    || (providerPaymentId && String(result?.id) !== String(providerPaymentId)))
    throw new HttpError(502, 'Thông tin đối soát payOS không khớp đơn hàng.');
  const state = String(result.status || '').toUpperCase();
  if (state === 'PAID') {
    if (Number(result.amountPaid) !== amount || !result.id || String(result.id).length > 191)
      throw new HttpError(502, 'payOS chưa xác nhận đủ tiền hoặc thiếu mã tham chiếu.');
    return {
      state: 'paid', provider: 'payos', code: String(code),
      amount, currency: 'VND', reference: String(result.id)
    };
  }
  if (state === 'CANCELLED') return { state: 'terminal_review' };
  return { state: 'pending' }; // Includes partial payments and unknown states.
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
    // Read-only provider inquiry. A redirect or an unchecked client parameter must
    // never grant a license. Only an authenticated provider inquiry can settle paid.
    async queryStatus({ code, amount, providerPaymentId }) {
      let result;
      try { result = await (await instance()).paymentRequests.get(Number(code)); }
      catch { throw new HttpError(503, 'Không truy vấn được trạng thái từ payOS.'); }
      return parsePayOsInquiry(result, { code, amount, providerPaymentId });
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
      const raw = `accessKey=${accessKey}&amount=${amount}&extraData=&ipnUrl=${ipnUrl}` +
        `&orderId=${code}&orderInfo=${description}&partnerCode=${partnerCode}` +
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
    async queryStatus({ code, amount }) {
      const requestId = `${code}-${randomUUID()}`;
      const signature = hmac(secretKey, `accessKey=${accessKey}&orderId=${code}&partnerCode=${partnerCode}&requestId=${requestId}`);
      const endpoint = production ? 'https://payment.momo.vn/v2/gateway/api/query'
        : 'https://test-payment.momo.vn/v2/gateway/api/query';
      let result;
      try {
        const response = await http(endpoint, {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ partnerCode, requestId, orderId: code, signature, lang: 'vi' }),
          signal: AbortSignal.timeout(35_000),
        });
        if (!response.ok) throw Error('MoMo HTTP error');
        result = await response.json();
      } catch { throw new HttpError(503, 'Không truy vấn được trạng thái từ MoMo.'); }
      // The authenticated HTTPS inquiry must match ALL identity and monetary fields.
      if (result?.partnerCode !== partnerCode || String(result?.orderId) !== String(code)
        || result?.requestId !== requestId || !Number.isSafeInteger(Number(result?.amount))
        || Number(result.amount) !== amount)
        throw new HttpError(502, 'Thông tin đối soát MoMo không khớp đơn hàng.');
      const resultCode = Number(result.resultCode);
      if (resultCode === 0) {
        const reference = String(result.transId || '');
        if (!/^[0-9]{1,30}$/.test(reference) || reference === '0')
          throw new HttpError(502, 'MoMo chưa cung cấp mã giao dịch hợp lệ.');
        return {
          state: 'paid', provider: 'momo', code: String(code),
          amount, currency: 'VND', reference
        };
      }
      // 9000 is authorization, NOT proof of capture in a two-step flow.
      if ([1000, 7000, 7002, 9000].includes(resultCode)) return { state: 'pending' };
      if ([1001, 1002, 1003, 1004, 1005, 1006, 1007, 1017, 1026].includes(resultCode))
        return { state: 'terminal_review' }; // Do not unlock on a query alone.
      return { state: 'pending' };
    },
    async verifyWebhook(body) {
      if (body.partnerCode !== partnerCode || !body.signature) throw new HttpError(400, 'MoMo IPN không hợp lệ.');
      const fields = ['accessKey', 'amount', 'extraData', 'message', 'orderId', 'orderInfo', 'orderType', 'partnerCode',
        'payType', 'requestId', 'responseTime', 'resultCode', 'transId'];
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
