import { randomUUID } from 'node:crypto';
import { HttpError, localizedError } from '../../shared/http.mjs';
import { demoPurchaseAllowed } from './demo-policy.mjs';
import { legacyOrderActive, legacyOrderGroup, summarizeEntitlements } from './entitlement-policy.mjs';

export class CheckoutService {
  constructor({ repository, config, catalog, env = process.env }) { Object.assign(this, { repository, config, catalog, env }); }
  async orders(user) {
    if (this.repository.allForUser) return this.repository.allForUser(user.sub);
    return this.repository.all().filter(order => order.userId === user.sub).reverse();
  }
  async purchase(user, templateId) {
    if (!demoPurchaseAllowed(this.config, this.env))
      throw localizedError(503, 'errors.payment.method');
    const template = await this.catalog.getTemplate(templateId);
    if (template.price === 0) return { free: true, templateId, status: 'free' };
    if (!Number.isSafeInteger(template.price) || template.price < 0 || template.price > 500000)
      throw new HttpError(400, 'Giá mẫu không hợp lệ.');
    // Only local-demo purchases. Never accept a client-supplied paid status or grant real revenue.
    if (this.repository.purchaseDemo) return this.repository.purchaseDemo({
      userId: user.sub, templateId, templateTitle: template.title, grossAmount: template.price,
    });
    const previous = this.repository.all().find(order =>
      order.userId === user.sub && order.templateId === templateId && legacyOrderActive(order));
    if (previous) return previous;
    const order = {
      id: randomUUID(), userId: user.sub, templateId, templateTitle: template.title,
      grossAmount: template.price, platformFee: Math.round(template.price * 0.2),
      creatorAmount: template.price - Math.round(template.price * 0.2),
      currency: 'VND', status: 'demo_paid', paymentProvider: 'local_demo_only',
      createdAt: new Date().toISOString(),
    };
    return this.repository.insert(order);
  }
  // API chỉ trả quyền của người dùng hiện tại; không dùng lịch sử đơn hàng làm quyền trên MySQL.
  async accessFor(user, templateId) {
    const template = await this.catalog.getTemplate(templateId);
    if (!Number.isSafeInteger(template.price) || template.price < 0)
      throw localizedError(503, 'errors.unavailable');
    const free = template.price === 0;
    return { templateId: template.id, free, licensed: free || await this.hasLicense(user.sub, template.id) === true };
  }
  async entitlementSummary(userId, templateId) {
    if ((userId === undefined) !== (templateId === undefined)) throw new Error('Incomplete entitlement scope');
    if (this.repository.entitlementGroups) {
      return summarizeEntitlements(await this.repository.entitlementGroups(userId, templateId), 'entitlements');
    }
    if (!this.repository.all) throw localizedError(503, 'errors.unavailable');
    const orders = this.repository.all().filter(order => userId === undefined ||
      (order.userId === userId && order.templateId === templateId));
    return summarizeEntitlements(orders.map(legacyOrderGroup), 'legacy_orders');
  }
  async entitlementDetails(user, templateId) {
    const template = await this.catalog.getTemplate(templateId);
    if (!Number.isSafeInteger(template.price) || template.price < 0)
      throw localizedError(503, 'errors.unavailable');
    const summary = await this.entitlementSummary(user.sub, template.id);
    const free = template.price === 0;
    return { templateId: template.id, free, licensed: free || summary.totals.active > 0, ...summary };
  }
  async adminEntitlementSummary(user) {
    if (user?.role !== 'admin') throw localizedError(403, 'errors.payment.adminReview');
    return this.entitlementSummary();
  }
  async hasLicense(userId, templateId) {
    if (this.repository.hasLicense) return this.repository.hasLicense(userId, templateId);
    return this.repository.all().some(order =>
      order.userId === userId && order.templateId === templateId && legacyOrderActive(order));
  }
}
