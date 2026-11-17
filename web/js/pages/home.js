import { icon } from "../ui/icons.js";

export function createHomeViews({ state, buttonLink, artwork, templateCard }) {
  function hero() {
    const featured = state.templates.find((t) => t.id === "midnight-bloom") ||
      state.templates[0] || {
        theme: "violet",
        title: "Midnight Bloom",
        subtitle: "A LITTLE WISH",
      };
    return `<section class="hero"><div class="container hero-grid">
      <div class="hero-copy">
        <span class="eyebrow eyebrow--outlined">${icon("sparkles", 15)} Một cách gửi yêu thương mới</span>
        <h1>Không chỉ là<br>một lời chúc.<br><em>Là một khoảnh khắc.</em></h1>
        <p>Biến những điều bạn muốn nói thành món quà tương tác đầy bất ngờ. Cá nhân hóa trong vài phút, gửi đi chỉ với một đường link.</p>
        <div class="hero-buttons">${buttonLink("/explore", "Tạo món quà đầu tiên")}<a href="/#how-it-works" data-link class="btn btn--outline">Xem cách hoạt động ${icon("arrow", 17)}</a></div>
        <div class="hero-proof"><div class="proof-icons"><span>${icon("heart", 17)}</span><span>${icon("gift", 17)}</span><span>${icon("sparkles", 17)}</span></div><span>Không cần biết thiết kế <strong>·</strong> Người nhận không cần tài khoản</span></div>
      </div>
      <div class="hero-display">
        <div class="hero-orbit hero-orbit--one"></div><div class="hero-orbit hero-orbit--two"></div>
        <span class="hero-tiny-spark hero-tiny-spark--a">${icon("sparkles", 30)}</span>
        <span class="hero-tiny-spark hero-tiny-spark--b">${icon("star", 25)}</span>
        <div class="hero-card-frame">${artwork(featured, "hero-artwork")}<div class="hero-card-caption">GỬI RIÊNG MỘT NGƯỜI THƯƠNG</div></div>
        <div class="floating-note floating-note--left">${icon("heart", 20)} <div><strong>Một điều thật riêng</strong><span>Chỉ dành cho người ấy</span></div></div>
        <div class="floating-note floating-note--right">${icon("message-circle", 19)} <div><strong>Lời hồi đáp</strong><span>Kỷ niệm của hai người</span></div></div>
      </div>
    </div></section>`;
  }

  function steps() {
    const items = [
      {
        number: "01",
        title: "Chọn điều bạn thích",
        text: "Khám phá những mẫu quà mang phong cách riêng, từ ngọt ngào đến tinh nghịch.",
        icon: "layers",
      },
      {
        number: "02",
        title: "Thêm dấu ấn của bạn",
        text: "Điền tên, một lời chúc và bức ảnh để món quà trở nên thật đặc biệt.",
        icon: "pencil",
      },
      {
        number: "03",
        title: "Gửi niềm vui đi xa",
        text: "Chia sẻ đường link. Người ấy mở quà, tương tác và để lại lời hồi đáp.",
        icon: "send",
      },
    ];
    return `<section id="how-it-works" class="section section--cream"><div class="container">
      <div class="section-heading section-heading--center"><span class="eyebrow">THẬT DỄ ĐỂ BẮT ĐẦU</span><h2>Chỉ ba bước, <em>ngàn cảm xúc.</em></h2><p>Không cần kỹ năng thiết kế. Chỉ cần bạn có điều muốn nói.</p></div>
      <div class="steps-grid">${items.map((item) => `<article class="step-card"><div class="step-number">${item.number}</div><div class="step-icon">${icon(item.icon, 28)}</div><h3>${item.title}</h3><p>${item.text}</p></article>`).join("")}</div>
    </div></section>`;
  }

  function home() {
    const featured = state.templates
      .filter((item) => item.featured)
      .slice(0, 3);
    return `${hero()}
      <section class="section section--white"><div class="container"><div class="section-heading section-heading--split">
        <div><span class="eyebrow">DÀNH RIÊNG CHO NHỮNG DỊP ĐẶC BIỆT</span><h2>Những món quà <em>được yêu thích.</em></h2></div>
        <a href="/explore" data-link class="inline-link">Xem tất cả mẫu ${icon("arrow", 19)}</a></div>
        <div class="template-grid">${featured.map(templateCard).join("")}</div></div></section>
      ${steps()}
      <section class="section section--white"><div class="container story-grid"><div class="story-visual"><div class="story-letter"><div class="story-letter__icon">${icon("heart", 34)}</div><p>Có những điều, nói một lần vẫn chưa đủ.</p><span>— MỘT LỜI NHẮN GỬI</span></div><div class="story-seal">${icon("sparkles", 22)}</div></div>
        <div class="story-content"><span class="eyebrow">HƠN CẢ MỘT TẤM THIỆP</span><h2>Món quà kết thúc,<br><em>kỷ niệm ở lại.</em></h2><p>Ở Momevia, người nhận không chỉ xem lời chúc. Họ có thể mở từng bất ngờ, gửi lại lời nhắn và cùng bạn lưu giữ khoảnh khắc ấy.</p><ul class="feature-list"><li>${icon("check-circle", 18)} Trải nghiệm tương tác trên điện thoại</li><li>${icon("check-circle", 18)} Lời hồi đáp chỉ dành cho người có link</li><li>${icon("check-circle", 18)} Dễ chia sẻ, không cần cài ứng dụng</li></ul>${buttonLink("/explore", "Bắt đầu tạo quà")}</div></div></section>
      <section class="section creator-band"><div class="container creator-band__inner"><div><span class="eyebrow">DÀNH CHO NHÀ SÁNG TẠO</span><h2>Thiết kế của bạn.<br><em>Cảm xúc của ai đó.</em></h2><p>Biến ý tưởng đẹp thành những món quà có thể cá nhân hóa. Đăng mẫu miễn phí và bắt đầu xây dựng gian hàng riêng.</p>${buttonLink("/creator", "Khám phá Creator Studio", "btn--light")}</div><div class="creator-band__art">${icon("sparkles", 105)}</div></div></section>`;
  }

  function aboutPage() {
    const values = [
      {
        icon: "heart",
        title: "Cá nhân hóa",
        description:
          "Tên, hình ảnh và lời nhắn giúp mỗi món quà mang một câu chuyện riêng.",
      },
      {
        icon: "gift",
        title: "Trải nghiệm sống động",
        description:
          "Khám phá nhiều cảnh và tương tác, không chỉ dừng lại ở một tấm thiệp tĩnh.",
      },
      {
        icon: "shield",
        title: "Đơn giản và riêng tư",
        description:
          "Người nhận không cần tạo tài khoản; đường link được thiết kế để khó đoán.",
      },
    ];
    return `<section class="about-hero"><div class="container about-hero__inner">
      <span class="eyebrow eyebrow--outlined">VỀ CHÚNG TÔI · MOMEVIA</span>
      <h1>Chúng mình tin rằng<br><em>yêu thương cần được cảm nhận.</em></h1>
      <p>Momevia là nền tảng quà tặng số tương tác dành cho những người muốn tạo bất ngờ, gửi lời chúc và lưu giữ kỷ niệm ngay cả khi ở xa nhau.</p>
      ${buttonLink("/explore", "Khám phá quà tặng")}
    </div></section>
    <section class="section section--white"><div class="container">
      <div class="section-heading section-heading--center"><span class="eyebrow">ĐIỀU CHÚNG MÌNH THEO ĐUỔI</span><h2>Mỗi món quà, <em>một kết nối.</em></h2><p>Trải nghiệm được thiết kế xoay quanh cả người gửi lẫn người nhận.</p></div>
      <div class="about-values">${values.map((value) => `<article class="about-value"><span class="about-value__icon">${icon(value.icon, 25)}</span><h2>${value.title}</h2><p>${value.description}</p></article>`).join("")}</div>
    </div></section>
    <section class="section section--cream"><div class="container about-story">
      <div><span class="eyebrow">CÂU CHUYỆN SẢN PHẨM</span><h2>Không chỉ gửi đi.<br><em>Hãy để cảm xúc tiếp nối.</em></h2><p>Chọn một thiết kế, thêm dấu ấn riêng rồi gửi qua đường link. Người nhận có thể tương tác, khám phá bất ngờ và để lại lời hồi đáp trong cùng một trải nghiệm.</p><p>Momevia đang tiếp tục phát triển các tính năng mua mẫu và lưu giữ kỷ niệm. Bạn sẽ luôn được thông báo rõ trước khi phát sinh bất kỳ khoản phí nào.</p></div>
      <div class="about-story__card"><strong>“More than a greeting. A connection that continues.”</strong><span>MOMEVIA · GỬI ĐIỀU THƯƠNG, GIỮ KỶ NIỆM</span></div>
    </div></section>
    <section class="section section--white"><div class="container about-cta"><h2>Bắt đầu với một <em>lời chúc thật riêng.</em></h2><p>Không cần kỹ năng thiết kế. Chỉ cần một điều bạn muốn nói.</p>${buttonLink("/explore", "Chọn mẫu quà đầu tiên")}</div></section>`;
  }

  return { hero, steps, home, aboutPage };
}
