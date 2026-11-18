import { HttpError } from '../../shared/http.mjs';
import { RateLimiter } from '../../shared/rate-limit.mjs';
import { createMomoProvider, createPayOsProvider } from './providers.mjs';

export function paymentMethods(env = process.env) {
  if (env.PAYMENT_ENABLED !== 'true' || env.CHECKOUT_STORAGE !== 'mysql'
    || env.IDENTITY_STORAGE !== 'mysql' || env.CATALOG_STORAGE !== 'mysql') return [];
  // A production provider must NEVER be enabled by NODE_ENV=development alone.
  // Likewise, a deployed production app must never expose a sandbox checkout.
  const live = env.PAYMENT_ENV === 'production' && env.PAYMENT_LIVE_ENABLED === 'true';
  const sandbox = env.PAYMENT_ENV === 'sandbox' && env.NODE_ENV !== 'production';
  if (!live && !sandbox) return [];
  const methods = [];
  if (live
    && env.PAYOS_CLIENT_ID && env.PAYOS_API_KEY && env.PAYOS_CHECKSUM_KEY)
    methods.push({ id: 'payos', label: 'Chuyển khoản / VietQR' });
  if ((live || sandbox)
    && env.MOMO_PARTNER_CODE && env.MOMO_ACCESS_KEY && env.MOMO_SECRET_KEY)
    methods.push({ id: 'momo', label: 'Ví MoMo' });
  return methods;
}

export class PaymentService {
  constructor({ repository, catalog, checkout, env = process.env, providers = null, reconcileLimiter = null }) {
    Object.assign(this, { repository, catalog, checkout, env, providers });
    // One lookup per buyer/order/30 seconds; limits provider API abuse in a single-process deployment.
    this.reconcileLimiter = reconcileLimiter || new RateLimiter({ limit: 1, windowMs: 30_000, maxKeys: 5000 });
    this.ownsReconcileLimiter = !reconcileLimiter;
  }
  close() { if (this.ownsReconcileLimiter) this.reconcileLimiter.close(); }
  provider(name) {
    if (this.providers) return this.providers[name];
    if (name === 'payos') return createPayOsProvider(this.env);
    if (name === 'momo') return createMomoProvider(this.env);
    return null;
  }
  methods() { return paymentMethods(this.env); }
  requireReady(name) {
    if (!this.methods().some(x => x.id === name)) throw new HttpError(503, 'Phương thức thanh toán chưa sẵn sàng.');
    if (this.env.NODE_ENV === 'production' && this.env.PAYMENT_ENV !== 'production')
      throw new HttpError(503, 'Không cho phép thanh toán thử nghiệm trên môi trường production.');
    const base = new URL(this.env.PUBLIC_BASE_URL || 'http://localhost:4100');
    if (base.protocol !== 'https:' || !base.hostname.includes('.'))
      throw new HttpError(503, 'Thanh toán cần PUBLIC_BASE_URL là HTTPS công khai để nhận webhook.');
    return base;
  }
  async create(user, templateId, method) {
    const base = this.requireReady(method);
    const template = await this.catalog.getTemplate(templateId);
    const amount = template.price;
    if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 500000)
      throw new HttpError(400, 'Giá mẫu phải trong khoảng 1.000–500.000 VND cho thanh toán trực tuyến.');
    if (this.env.CHECKOUT_STORAGE !== 'mysql' || this.env.IDENTITY_STORAGE !== 'mysql' || this.env.CATALOG_STORAGE !== 'mysql')
      throw new HttpError(503, 'Thanh toán yêu cầu Checkout, Identity và Catalog đều lưu MySQL.');
    if (this.checkout && await this.checkout.hasLicense(user.sub, templateId))
      throw new HttpError(409, 'Bạn đã có quyền sử dụng mẫu này.');
    // One pending or paid intent for each buyer/template; requests from the browser cannot set paid status.
    const intent = await this.repository.createPending({
      userId: user.sub, templateId, title: template.title, amount, provider: method,
      isTest: this.env.PAYMENT_ENV !== 'production',
    });
    // A stale/settled intent is not a new checkout; never return it as a successful create.
    if (intent.status !== 'pending') throw new HttpError(409, 'Giao dịch trước đã kết thúc. Liên hệ hỗ trợ để đối soát trước khi thanh toán lại.');
    // Check the provider BEFORE returning any cached checkout link.
    if (intent.provider !== method) throw new HttpError(409, 'Đã có đơn đang chờ thanh toán theo phương thức khác. Vui lòng hoàn tất hoặc liên hệ hỗ trợ để đối soát.');
    if (intent.checkoutUrl) return intent;
    const provider = this.provider(method);
    const urls = {
      returnUrl: new URL(`/payment-result/${encodeURIComponent(intent.orderId)}`, base).href,
      cancelUrl: new URL(`/payment-result/${encodeURIComponent(intent.orderId)}`, base).href,
      ipnUrl: new URL(`/api/checkout/payments/webhooks/${method}`, base).href,
    };
    const link = await provider.create({
      code: intent.code, amount: intent.amount,
      description: `MOMEVIA ${intent.code}`, ...urls
    });
    await this.repository.setLink(intent.id, link);
    return { ...intent, ...link };
  }
  async webhook(providerName, body) {
    // In-flight payment callbacks still need processing when new checkout creation is disabled.
    // Disabling NEW live checkouts must not discard signed callbacks from payments
    // already in flight. Still reject sandbox callbacks on a production deployment.
    if (this.env.NODE_ENV === 'production' && this.env.PAYMENT_ENV !== 'production')
      throw new HttpError(503, 'Webhook thanh toán thử nghiệm bị từ chối trên production.');
    const event = await this.provider(providerName).verifyWebhook(body);
    if (event.provider !== providerName) throw new HttpError(400, 'Sai nhà cung cấp thanh toán.');
    return this.repository.settleVerified(event);
  }
  async status(user, orderId) {
    const record = await this.repository.forUser(orderId, user.sub);
    if (!record) throw new HttpError(404, 'Không tìm thấy giao dịch.');
    // Pending payment links can remain valid at a bank after our page times out.
    // Do NOT release unique checkout locks by timer: require provider reconciliation.
    const pendingSince = record.createdAt || null;
    const ageMs = pendingSince ? Date.now() - Date.parse(pendingSince) : 0;
    const needsReview = record.status === 'pending' && Number.isFinite(ageMs) && ageMs >= 30 * 60_000;
    return {
      orderId: record.orderId, status: record.status, method: record.provider,
      amountVnd: record.amount, checkoutUrl: record.checkoutUrl,
      pendingSince, needsReview,
      ...(needsReview ? { notice: 'Giao dịch chờ xác nhận lâu. Nếu đã thanh toán, không thanh toán lại; liên hệ hỗ trợ kèm mã đơn để đối soát.' } : {})
    };
  }
  async reconcile(user, orderId) {
    // Ownership MUST be checked before any provider request or rate-limit consumption.
    const intent = await this.repository.forUser(orderId, user.sub);
    if (!intent) throw new HttpError(404, 'Không tìm thấy giao dịch.');
    if (intent.status === 'paid') return { payment: await this.status(user, orderId), providerState: 'paid' };
    if (intent.status !== 'pending' || !intent.checkoutUrl || !intent.code)
      throw new HttpError(409, 'Giao dịch không ở trạng thái có thể đối soát tự động.');
    if (!['momo', 'payos'].includes(intent.provider)) throw new HttpError(503, 'Nhà cung cấp không được hỗ trợ.');
    // Queries of existing checkouts are allowed while NEW payments are disabled,
    // but NEVER cross sandbox/live boundaries or ignore the original order mode.
    if (intent.isTest == null || Boolean(intent.isTest) !== (this.env.PAYMENT_ENV === 'sandbox')
      || !['sandbox', 'production'].includes(this.env.PAYMENT_ENV)
      || (this.env.NODE_ENV === 'production' && intent.isTest))
      throw new HttpError(503, 'Môi trường đối soát không khớp giao dịch ban đầu.');
    if (!this.reconcileLimiter.consume(`${user.sub}:${orderId}`))
      throw new HttpError(429, 'Vui lòng đợi 30 giây trước khi đối soát lại.');
    const adapter = this.provider(intent.provider);
    if (!adapter || typeof adapter.queryStatus !== 'function')
      throw new HttpError(503, 'Nhà cung cấp chưa hỗ trợ truy vấn trạng thái.');
    const result = await adapter.queryStatus({
      code: intent.code, amount: intent.amount,
      providerPaymentId: intent.providerPaymentId
    });
    if (!result || !['paid', 'pending', 'terminal_review'].includes(result.state))
      throw new HttpError(502, 'Kết quả đối soát từ nhà cung cấp không hợp lệ.');
    if (result.state === 'paid') {
      if (result.provider !== intent.provider || result.code !== intent.code
        || result.amount !== intent.amount || result.currency !== 'VND' || !result.reference)
        throw new HttpError(502, 'Giao dịch trả về không khớp dữ liệu thanh toán.');
      await this.repository.settleVerified({ ...result, success: true });
    }
    const payment = await this.status(user, orderId);
    // Failed/cancelled results remain under operator review until a safe
    // provider-specific cancellation/retry workflow is implemented.
    return {
      payment, providerState: result.state,
      ...(result.state === 'terminal_review'
        ? { notice: 'Nhà cung cấp báo giao dịch không hoàn tất. Vui lòng liên hệ hỗ trợ để kiểm tra trước khi thanh toán lại.' }
        : {})
    };
  }
  async receipt(user, orderId) {
    const result = await this.repository.receipt(orderId, user.sub);
    if (!result) throw new HttpError(404, 'Biên nhận chưa sẵn có hoặc không thuộc tài khoản.');
    return result;
  }
}
