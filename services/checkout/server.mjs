import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { environment } from '../shared/config.mjs';
import { JsonRepository } from '../shared/storage.mjs';
import { Router, HttpError, parseJson, sendJson, internalFetch, requireInternal } from '../shared/http.mjs';
import { currentUser, sanitizeText } from '../shared/security.mjs';

const config = environment();
const repository = new JsonRepository(path.resolve('services/checkout/data/orders.json'));
const router = new Router();

class CheckoutService {
  async purchase(user, templateId) {
    if (!config.demoEnabled) throw new HttpError(503, 'Thanh toán thực chưa được cấu hình. Chế độ đơn hàng demo đã tắt.');
    const { template } = await internalFetch(`http://127.0.0.1:4102/internal/templates/${encodeURIComponent(templateId)}`, config.internalKey);
    if (template.price === 0) return { free: true, templateId, status: 'free' };
    // Không lưu thông tin thẻ hoặc tự giả nhận webhook từ nhà cung cấp.
    const previous = repository.all().find(order => order.userId === user.sub && order.templateId === templateId && order.status === 'demo_paid');
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
    return repository.insert(order);
  }
  hasLicense(userId, templateId) {
    return repository.all().some(order => order.userId === userId && order.templateId === templateId && order.status === 'demo_paid');
  }
}
const service = new CheckoutService();
router.on('GET', '/health', ({res}) => sendJson(res, 200, {name:'checkout', ok:true}));
router.on('GET', '/orders', ({req,res}) => {
  const user = currentUser(req, config.jwtSecret);
  sendJson(res, 200, { orders: repository.all().filter(order => order.userId === user.sub).reverse() });
});
router.on('POST', '/orders/demo-purchase', async ({req,res}) => {
  const user = currentUser(req, config.jwtSecret);
  const data = await parseJson(req);
  const templateId = sanitizeText(data.templateId, 100);
  const order = await service.purchase(user, templateId);
  sendJson(res, 201, { order, notice: 'Chỉ là đơn hàng mô phỏng. Không thu tiền thật.' });
});
router.on('GET', '/internal/license/:userId/:templateId', ({req,res,params}) => {
  requireInternal(req, config.internalKey);
  sendJson(res, 200, { licensed: service.hasLicense(params.userId, params.templateId) });
});
router.listen(4104);
