import { randomUUID } from 'node:crypto';
import { HttpError } from '../../shared/http.mjs';

export class CheckoutService {
  constructor({ repository, config, catalog }) { this.repository = repository; this.config = config; this.catalog = catalog; }
  orders(user) { return this.repository.all().filter(order => order.userId === user.sub).reverse(); }

  async purchase(user, templateId) {
    if (!this.config.demoEnabled) throw new HttpError(503, 'Thanh toán thực chưa được cấu hình. Chế độ đơn hàng demo đã tắt.');
    const template = await this.catalog.getTemplate(templateId);
    if (template.price === 0) return { free: true, templateId, status: 'free' };
    // Không lưu thông tin thẻ hoặc tự giả nhận webhook từ nhà cung cấp.
    const previous = this.repository.all().find(order => order.userId === user.sub && order.templateId === templateId && order.status === 'demo_paid');
    if (previous) return previous;
    const order = {
      id: randomUUID(),
      userId: user.sub,
      templateId,
      templateTitle: template.title,
      grossAmount: template.price,
      platformFee: Math.round(template.price * 0.2),
      creatorAmount: template.price - Math.round(template.price * 0.2),
      currency: 'VND',
      status: 'demo_paid',
      paymentProvider: 'local_demo_only',
      createdAt: new Date().toISOString(),
    };
    return this.repository.insert(order);
  }
  hasLicense(userId, templateId) {
    return this.repository.all().some(order => order.userId === userId && order.templateId === templateId && order.status === 'demo_paid');
  }
}
