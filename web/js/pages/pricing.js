import { icon } from '../ui/icons.js';

/** Informational pricing page; no subscriptions are created or billed here. */
export function pricingPage() {
  const features = items => items.map(item => `<li>${icon('check-circle', 17)}<span>${item}</span></li>`).join('');
  const tiers = [
    {
      name: 'Mẫu miễn phí', badge: 'Bắt đầu miễn phí', price: '0đ cho mẫu miễn phí',
      description: 'Khám phá các mẫu được ghi rõ là miễn phí. Không cần mua gói thuê bao để bắt đầu.',
      benefits: ['Xem và chọn mẫu có giá 0đ', 'Cá nhân hóa và chia sẻ qua liên kết', 'Người nhận không cần tài khoản'],
      action: 'Khám phá mẫu miễn phí', href: '/explore', featured: false,
    },
    {
      name: 'Mua theo mẫu', badge: 'Không cần thuê bao', price: 'Giá hiển thị trên từng mẫu',
      description: 'Chọn mẫu trả phí khi cần; chỉ ghi nhận thanh toán khi cổng thanh toán được kích hoạt và xác thực.',
      benefits: ['Xem giá trước khi xác nhận mua', 'Cấp quyền sử dụng sau khi thanh toán hợp lệ', 'Xem lại trạng thái giao dịch và biên nhận'],
      action: 'Xem thư viện mẫu', href: '/explore', featured: true,
    },
    {
      name: 'Creator Pro', badge: 'Đề xuất v1.2 · Chưa mở bán', price: 'Chưa công bố mức phí',
      description: 'Gói công cụ nâng cao dành cho nhà sáng tạo đang ở giai đoạn lên kế hoạch, chưa có thuê bao hay gia hạn tự động.',
      benefits: ['Dự kiến: phân tích hiệu quả mẫu', 'Dự kiến: nhận diện thương hiệu', 'Thời gian dùng thử sẽ xác định trước khi mở bán'],
      action: 'Tìm hiểu Creator Studio', href: '/creator', featured: false,
    },
  ];
  return `<section class="section section--cream pricing-page"><div class="container">
    <div class="pricing-intro"><span class="eyebrow eyebrow--outlined">CÁCH SỬ DỤNG MOMEVIA</span>
      <h1>Bắt đầu miễn phí.<br><em>Chọn thêm khi bạn cần.</em></h1>
      <p>Mỗi món quà có thể có mức giá riêng. Bạn không cần đăng ký thuê bao để khám phá và lựa chọn mẫu.</p>
    </div>
    <p class="pricing-disclaimer" role="note"><strong>Thông tin minh bạch:</strong> Đây là trang giới thiệu cách tính phí và phương án gói đang xem xét. Momevia chưa mở bán thuê bao Creator Pro và không tự động tính phí sau thời gian dùng thử. Thanh toán theo mẫu chỉ khả dụng khi cổng thanh toán được cấu hình và bật.</p>
    <div class="pricing-grid">${tiers.map(tier => `<article class="pricing-card${tier.featured ? ' pricing-card--featured' : ''}">
      <span class="pricing-card__badge">${tier.badge}</span><h2>${tier.name}</h2>
      <p class="pricing-card__price">${tier.price}</p><p class="pricing-card__desc">${tier.description}</p>
      <ul>${features(tier.benefits)}</ul><a href="${tier.href}" data-link class="btn ${tier.featured ? 'btn--dark' : 'btn--outline'}">${tier.action} ${icon('arrow', 17)}</a>
    </article>`).join('')}</div>
    <div class="pricing-faq"><h2>Câu hỏi thường gặp</h2>
      <details><summary>Có bắt buộc đăng ký gói trả phí để dùng Momevia không?</summary><p>Không. Bạn có thể chọn các mẫu miễn phí. Mẫu có giá riêng được thanh toán theo từng mẫu, tùy tình trạng kích hoạt cổng thanh toán.</p></details>
      <details><summary>Hết thời gian dùng thử có bị tự động trừ tiền không?</summary><p>Hiện Momevia chưa triển khai gói dùng thử thuê bao hoặc gia hạn tự động. Nếu ra mắt sau này, thời hạn, giá, điều kiện gia hạn và cách hủy phải được hiển thị rõ trước khi đăng ký.</p></details>
      <details><summary>Thanh toán xong tôi sẽ nhận gì?</summary><p>Khi nhà cung cấp xác nhận giao dịch thành công, hệ thống cấp quyền sử dụng mẫu và cho xem biên nhận giao dịch. Biên nhận không mặc nhiên là hóa đơn điện tử VAT.</p></details>
    </div>
  </div></section>`;
}
