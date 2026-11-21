import { localizedError } from '../../shared/http.mjs';
import { RateLimiter } from '../../shared/rate-limit.mjs';
import { createMomoProvider, createPayOsProvider } from './providers.mjs';
import { canonicalText } from '../../../web/js/shared/locale.js';

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
    methods.push({ id: 'payos', label: canonicalText('payment.methods.payos') });
  if ((live || sandbox)
    && env.MOMO_PARTNER_CODE && env.MOMO_ACCESS_KEY && env.MOMO_SECRET_KEY)
    methods.push({ id: 'momo', label: canonicalText('payment.methods.momo') });
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
    if (!this.methods().some(x => x.id === name)) throw localizedError(503, 'errors.payment.method');
    if (this.env.NODE_ENV === 'production' && this.env.PAYMENT_ENV !== 'production')
      throw localizedError(503, 'errors.payment.testDisabled');
    const base = new URL(this.env.PUBLIC_BASE_URL || 'http://localhost:4100');
    if (base.protocol !== 'https:' || !base.hostname.includes('.'))
      throw localizedError(503, 'errors.payment.url');
    return base;
  }
  async create(user, templateId, method) {
    const base = this.requireReady(method);
    const template = await this.catalog.getTemplate(templateId);
    const amount = template.price;
    if (!Number.isSafeInteger(amount) || amount < 1000 || amount > 500000)
      throw localizedError(400, 'errors.payment.priceRange');
    if (this.env.CHECKOUT_STORAGE !== 'mysql' || this.env.IDENTITY_STORAGE !== 'mysql' || this.env.CATALOG_STORAGE !== 'mysql')
      throw localizedError(503, 'errors.payment.storage');
    if (this.checkout && await this.checkout.hasLicense(user.sub, templateId))
      throw localizedError(409, 'errors.payment.alreadyLicensed');
    // One pending or paid intent for each buyer/template; requests from the browser cannot set paid status.
    const intent = await this.repository.createPending({
      userId: user.sub, templateId, title: template.title, amount, provider: method,
      isTest: this.env.PAYMENT_ENV !== 'production',
    });
    // A stale/settled intent is not a new checkout; never return it as a successful create.
    if (intent.status !== 'pending') throw localizedError(409, 'errors.payment.previousClosed');
    // Check the provider BEFORE returning any cached checkout link.
    if (intent.provider !== method) throw localizedError(409, 'errors.payment.otherMethod');
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
      throw localizedError(503, 'errors.payment.productionWebhook');
    const event = await this.provider(providerName).verifyWebhook(body);
    if (event.provider !== providerName) throw localizedError(400, 'errors.payment.providerMismatch');
    return this.repository.settleVerified(event);
  }
  async status(user, orderId) {
    const record = await this.repository.forUser(orderId, user.sub);
    if (!record) throw localizedError(404, 'errors.payment.notFound');
    // Pending payment links can remain valid at a bank after our page times out.
    // Do NOT release unique checkout locks by timer: require provider reconciliation.
    const pendingSince = record.createdAt || null;
    const ageMs = pendingSince ? Date.now() - Date.parse(pendingSince) : 0;
    const needsReview = record.status === 'pending' && Number.isFinite(ageMs) && ageMs >= 30 * 60_000;
    return {
      orderId: record.orderId, status: record.status, method: record.provider,
      amountVnd: record.amount, checkoutUrl: record.checkoutUrl,
      pendingSince, needsReview,
      ...(needsReview ? { notice: canonicalText('payment.status.longPending') } : {})
    };
  }
  // Administrative payment review is read-only. Authorization uses the session
  // resolved by Identity; never accept a role supplied by the browser.
  requireAdmin(user) {
    if (user?.role !== 'admin') throw localizedError(403, 'errors.payment.adminReview');
  }
  reviewLimit(value) {
    if (value === undefined || value === null || value === '') return 50;
    if (!/^[1-9][0-9]{0,2}$/.test(String(value)) || Number(value) > 100)
      throw localizedError(400, 'errors.payment.reviewLimit');
    return Number(value);
  }
  async pendingReview(admin, limit) {
    this.requireAdmin(admin);
    return this.repository.pendingReview(this.reviewLimit(limit));
  }
  async reconciliationHistory(admin, orderId, limit) {
    this.requireAdmin(admin);
    if (typeof orderId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId))
      throw localizedError(400, 'errors.payment.invalidOrder');
    return this.repository.reconciliationHistory(orderId, this.reviewLimit(limit));
  }
  requireFinanceStorage() {
    if (this.env.CHECKOUT_STORAGE !== 'mysql')
      throw localizedError(503, 'errors.payment.storage');
  }
  requireCreator(user) {
    if (!user?.sub || !['creator', 'admin'].includes(user.role))
      throw localizedError(403, 'errors.forbidden');
  }
  async creatorStatement(user, limit) {
    // Không nhận creatorId từ query hoặc body: chỉ đọc ledger của phiên đang đăng nhập.
    this.requireCreator(user);
    this.requireFinanceStorage();
    return this.repository.creatorStatement(user.sub, this.reviewLimit(limit));
  }
  async adminFinance(user) {
    this.requireAdmin(user);
    this.requireFinanceStorage();
    return this.repository.adminFinance();
  }
  async reconcile(user, orderId) {
    // Ownership MUST be checked before any provider request or rate-limit consumption.
    const intent = await this.repository.forUser(orderId, user.sub);
    if (!intent) throw localizedError(404, 'errors.payment.notFound');
    if (intent.status === 'paid') return { payment: await this.status(user, orderId), providerState: 'paid' };
    if (intent.status !== 'pending' || !intent.checkoutUrl || !intent.code)
      throw localizedError(409, 'errors.payment.reviewState');
    if (!['momo', 'payos'].includes(intent.provider)) throw localizedError(503, 'errors.payment.providerUnsupported');
    // Queries of existing checkouts are allowed while NEW payments are disabled,
    // but NEVER cross sandbox/live boundaries or ignore the original order mode.
    if (intent.isTest == null || Boolean(intent.isTest) !== (this.env.PAYMENT_ENV === 'sandbox')
      || !['sandbox', 'production'].includes(this.env.PAYMENT_ENV)
      || (this.env.NODE_ENV === 'production' && intent.isTest))
      throw localizedError(503, 'errors.payment.reviewEnvironment');
    if (!this.reconcileLimiter.consume(`${user.sub}:${orderId}`))
      throw localizedError(429, 'errors.payment.reviewCooldown');
    const adapter = this.provider(intent.provider);
    if (!adapter || typeof adapter.queryStatus !== 'function')
      throw localizedError(503, 'errors.payment.reviewUnavailable');
    // Record only safe audit metadata, never the provider response body, tokens or signatures.
    const audit = async outcome => {
      if (typeof this.repository.recordReconciliation === 'function') {
        await this.repository.recordReconciliation({ intentId: intent.id, actorId: user.sub, outcome });
      }
    };
    let result;
    try {
      result = await adapter.queryStatus({
        code: intent.code, amount: intent.amount,
        providerPaymentId: intent.providerPaymentId
      });
    } catch (error) {
      await audit('provider_error');
      throw error;
    }
    if (!result || !['paid', 'pending', 'terminal_review'].includes(result.state)) {
      await audit('invalid_response');
      throw localizedError(502, 'errors.payment.reviewResult');
    }
    if (result.state === 'paid') {
      if (result.provider !== intent.provider || result.code !== intent.code
        || result.amount !== intent.amount || result.currency !== 'VND' || !result.reference) {
        await audit('mismatch');
        throw localizedError(502, 'errors.payment.reviewMismatch');
      }
      try {
        await this.repository.settleVerified({ ...result, success: true });
      } catch (error) {
        await audit('settlement_error');
        throw error;
      }
    }
    await audit(result.state);
    const payment = await this.status(user, orderId);
    // Failed/cancelled results remain under operator review until a safe
    // provider-specific cancellation/retry workflow is implemented.
    return {
      payment, providerState: result.state,
      ...(result.state === 'terminal_review'
        ? { notice: canonicalText('payment.status.terminal') }
        : {})
    };
  }
  async receipt(user, orderId) {
    const result = await this.repository.receipt(orderId, user.sub);
    if (!result) throw localizedError(404, 'errors.payment.receiptUnavailable');
    return result;
  }
}
