import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { localizedError } from '../../shared/http.mjs';
import { paymentReference, providerInteger } from './settlement-evidence.mjs';

const hmac = (key, content) => createHmac('sha256', key).update(content).digest('hex');
function equalHex(a, b) {
  if (typeof a !== 'string' || !/^[a-f0-9]{64}$/i.test(a)) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

// A payment-link state is provider-owned evidence; never trust a browser redirect.
export function parsePayOsInquiry(result, { code, amount, providerPaymentId }) {
  if (String(result?.orderCode) !== String(code) || providerInteger(result?.amount) !== amount
    || (providerPaymentId && String(result?.id) !== String(providerPaymentId)))
    throw localizedError(502, 'errors.payment.payOsMismatch');
  const state = String(result.status || '').toUpperCase();
  if (state === 'PAID') {
    if (providerInteger(result.amountPaid) !== amount || !paymentReference(result.id))
      throw localizedError(502, 'errors.payment.payOsIncomplete');
    // Không dùng ID link làm mã giao dịch. Nhiều khoản chuyển cần đối soát riêng.
    const transactions = result.transactions;
    if (!Array.isArray(transactions) || transactions.length !== 1
      || providerInteger(transactions[0]?.amount) !== amount
      || !paymentReference(transactions[0]?.reference)) return { state: 'terminal_review' };
    return {
      state: 'paid', provider: 'payos', code: String(code),
      amount, currency: 'VND', reference: transactions[0].reference, providerPaymentId: result.id
    };
  }
  if (['CANCELLED', 'EXPIRED'].includes(state)) return { state: 'terminal_review' };
  return { state: 'pending' }; // Includes partial payments and unknown states.
}

// Chuẩn hóa dữ liệu đã được SDK xác minh, không dùng ID link thay mã giao dịch.
export function parsePayOsWebhook(data, body) {
  const amount = providerInteger(data?.amount);
  if (!data?.orderCode || amount === null) throw localizedError(400, 'errors.payment.payOsWebhook');
  const success = body.success === true && body.code === '00' && data.code === '00';
  if (success && (!paymentReference(data.reference) || !paymentReference(data.paymentLinkId) || data.currency !== 'VND'))
    throw localizedError(400, 'errors.payment.payOsWebhook');
  return { code: String(data.orderCode), amount, reference: data.reference,
    currency: data.currency, provider: 'payos', providerPaymentId: data.paymentLinkId, success };
}

// PayOS SDK handles the provider-specific canonical signature format and webhook validation.
export function createPayOsProvider(env = process.env) {
  const { PAYOS_CLIENT_ID: clientId, PAYOS_API_KEY: apiKey, PAYOS_CHECKSUM_KEY: checksumKey } = env;
  if (![clientId, apiKey, checksumKey].every(x => typeof x === 'string' && x.length >= 8))
    throw localizedError(503, 'errors.payment.payOsConfig');
  let sdk;
  async function instance() {
    if (!sdk) {
      let PayOS;
      try { ({ PayOS } = await import('@payos/node')); }
      catch { throw localizedError(503, 'errors.payment.payOsPackage'); }
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
      catch { throw localizedError(503, 'errors.payment.payOsInquiry'); }
      return parsePayOsInquiry(result, { code, amount, providerPaymentId });
    },
    async verifyWebhook(body) {
      const data = await (await instance()).webhooks.verify(body);
      return parsePayOsWebhook(data, body);
    },
  };
}

// MoMo v2 captureWallet API, merchant must configure partner credentials and a PUBLIC HTTPS IPN URL.
export function createMomoProvider(env = process.env, http = fetch) {
  const { MOMO_PARTNER_CODE: partnerCode, MOMO_ACCESS_KEY: accessKey, MOMO_SECRET_KEY: secretKey } = env;
  if (![partnerCode, accessKey, secretKey].every(x => typeof x === 'string' && x.length >= 4))
    throw localizedError(503, 'errors.payment.momoConfig');
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
      if (!response.ok || result.resultCode !== 0 || !result.payUrl) throw localizedError(502, 'errors.payment.momoCreate');
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
      } catch { throw localizedError(503, 'errors.payment.momoInquiry'); }
      // The authenticated HTTPS inquiry must match ALL identity and monetary fields.
      if (result?.partnerCode !== partnerCode || String(result?.orderId) !== String(code)
        || result?.requestId !== requestId || providerInteger(result?.amount) !== amount)
        throw localizedError(502, 'errors.payment.momoMismatch');
      const resultCode = providerInteger(result.resultCode);
      if (resultCode === null) throw localizedError(502, 'errors.payment.momoMismatch');
      if (resultCode === 0) {
        const reference = typeof result.transId === 'string' || Number.isSafeInteger(result.transId) ? String(result.transId) : '';
        if (!/^[0-9]{1,30}$/.test(reference) || /^0+$/.test(reference))
          throw localizedError(502, 'errors.payment.momoReference');
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
      if (body.partnerCode !== partnerCode || !body.signature) throw localizedError(400, 'errors.payment.momoIpn');
      const fields = ['accessKey', 'amount', 'extraData', 'message', 'orderId', 'orderInfo', 'orderType', 'partnerCode',
        'payType', 'requestId', 'responseTime', 'resultCode', 'transId'];
      const values = { ...body, accessKey };
      if (fields.some(k => values[k] === undefined || values[k] === null)) throw localizedError(400, 'errors.payment.momoIpnFields');
      const payload = fields.map(k => `${k}=${values[k]}`).join('&');
      if (!equalHex(hmac(secretKey, payload), body.signature)) throw localizedError(400, 'errors.payment.momoIpnSignature');
      const resultCode = providerInteger(body.resultCode);
      const amount = providerInteger(body.amount);
      const reference = typeof body.transId === 'string' || Number.isSafeInteger(body.transId) ? String(body.transId) : '';
      if (resultCode === null || amount === null || (resultCode === 0
        && (!/^[0-9]{1,30}$/.test(reference) || /^0+$/.test(reference) || String(body.requestId) !== String(body.orderId))))
        throw localizedError(400, 'errors.payment.momoIpnFields');
      return { code: String(body.orderId), amount, reference, currency: 'VND', provider: 'momo', success: resultCode === 0 };
    },
  };
}
