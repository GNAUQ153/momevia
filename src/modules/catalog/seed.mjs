// Dữ liệu minh họa; ảnh tác phẩm được tạo bằng CSS, không sử dụng hình ảnh có bản quyền.
export const templates = [
  { id: 'midnight-bloom', title: 'Midnight Bloom', subtitle: 'Một khu vườn dành riêng cho người ấy', theme: 'violet', style: 'Lãng mạn', price: 59000, scenes: 3, effect: 'Bung nở', creator: 'Momevia Originals', featured: true },
  { id: 'sunny-wishes', title: 'Sunny Wishes', subtitle: 'Gửi một ngày rực rỡ và ngọt ngào', theme: 'sunshine', style: 'Tươi vui', price: 0, scenes: 3, effect: 'Lật thiệp', creator: 'Momevia Originals', featured: true },
  { id: 'love-letter', title: 'The Love Letter', subtitle: 'Đôi điều nhỏ dành cho người đặc biệt', theme: 'rose', style: 'Tình cảm', price: 79000, scenes: 3, effect: 'Mở thư', creator: 'Momevia Originals', featured: true },
  { id: 'starlight', title: 'Starlight Night', subtitle: 'Ước một điều, nhận ngàn vì sao', theme: 'navy', style: 'Kỳ ảo', price: 59000, scenes: 3, effect: 'Ánh sao', creator: 'Momevia Originals' },
  { id: 'peachy-day', title: 'Peachy Day', subtitle: 'Một chút dịu dàng trong ngày mới', theme: 'peach', style: 'Tối giản', price: 39000, scenes: 3, effect: 'Tan chảy', creator: 'Momevia Originals' },
  { id: 'greenhouse', title: 'Little Greenhouse', subtitle: 'Gieo những điều tốt đẹp', theme: 'sage', style: 'Thiên nhiên', price: 39000, scenes: 3, effect: 'Bung nở', creator: 'Momevia Originals' },
  { id: 'confetti', title: 'Make a Wish', subtitle: 'Mở tiệc ngay trong lòng bàn tay', theme: 'coral', style: 'Tươi vui', price: 0, scenes: 3, effect: 'Pháo giấy', creator: 'Momevia Originals' },
  { id: 'cloud-nine', title: 'On Cloud Nine', subtitle: 'Cảm xúc nhẹ như một áng mây', theme: 'sky', style: 'Tối giản', price: 39000, scenes: 3, effect: 'Trôi mây', creator: 'Momevia Originals' },
  { id: 'lavender', title: 'Lavender Field', subtitle: 'Dịu dàng như những mùa nhớ', theme: 'lilac', style: 'Lãng mạn', price: 59000, scenes: 3, effect: 'Bung nở', creator: 'Momevia Originals' },
  { id: 'polaroid', title: 'Captured Moments', subtitle: 'Tập hợp những khoảnh khắc đáng yêu', theme: 'cream', style: 'Hoài niệm', price: 79000, scenes: 3, effect: 'Lật ảnh', creator: 'Momevia Originals' },
  { id: 'afterglow', title: 'Afterglow', subtitle: 'Mọi điều đẹp đều có ánh sáng riêng', theme: 'amber', style: 'Kỳ ảo', price: 59000, scenes: 3, effect: 'Ánh sáng', creator: 'Momevia Originals' },
  { id: 'tiny-celebration', title: 'Tiny Celebration', subtitle: 'Dành cho những niềm vui thật lớn', theme: 'mint', style: 'Tươi vui', price: 0, scenes: 3, effect: 'Bật mí', creator: 'Momevia Originals' },
  { id: 'mot-ky-niem', title: 'Một kỷ niệm của hai mình', subtitle: 'Gửi một tấm ảnh, một dòng chú thích và lời chúc sinh nhật.', theme: 'cream', style: 'Hoài niệm', price: 0, scenes: 3, effect: 'Mở thư', creator: 'Momevia Originals' },
  { id: 'hai-phong-bi', title: 'Hai phong bì', subtitle: 'Người nhận tự chọn mở kỷ niệm hay lời chúc trước.', theme: 'lilac', style: 'Tình cảm', price: 0, scenes: 3, effect: 'Mở thư', creator: 'Momevia Originals' },
  // Bộ sưu tập lan truyền 2026–2027: 10 mẫu miễn phí trong đợt marketing đầu tiên.
  // Thời gian là khung truyền thông của Momevia, không phải lịch nghỉ lễ chính thức.
  { id: 'winter-wishes-2026', title: 'Winter Wishes', subtitle: 'Thiệp Giáng sinh trong khu vườn tuyết và ánh đèn vàng.', theme: 'sage', style: 'Lễ hội', category: 'Giáng sinh', price: 0, scenes: 3, effect: 'Mở món quà', creator: 'Momevia Originals', isSeasonal: true, season: 'Giáng sinh 2026', availableFrom: '2026-11-10', availableTo: '2026-12-26', featured: true },
  { id: 'new-year-spark-2027', title: 'Midnight Countdown', subtitle: 'Chào năm mới 2027 bằng ánh pháo hoa và những ước nguyện.', theme: 'navy', style: 'Lễ hội', category: 'Năm mới', price: 0, scenes: 3, effect: 'Pháo hoa', creator: 'Momevia Originals', isSeasonal: true, season: 'Năm mới 2027', availableFrom: '2026-12-20', availableTo: '2027-01-07', featured: true },
  { id: 'spring-blessing-2027', title: 'Spring Blessing', subtitle: 'Gửi lời chúc Tết 2027 cùng hoa mai, hoa đào và sắc xuân.', theme: 'coral', style: 'Lễ hội', category: 'Tết Nguyên đán', price: 0, scenes: 3, effect: 'Mở lì xì', creator: 'Momevia Originals', isSeasonal: true, season: 'Tết Nguyên đán 2027', availableFrom: '2027-01-15', availableTo: '2027-02-22', featured: true },
  { id: 'velvet-valentine-2027', title: 'Velvet Valentine', subtitle: 'Lá thư tình mang dấu niêm phong dành riêng cho người ấy.', theme: 'rose', style: 'Lễ hội', category: 'Valentine', price: 0, scenes: 3, effect: 'Mở thư', creator: 'Momevia Originals', isSeasonal: true, season: 'Valentine 2027', availableFrom: '2027-02-01', availableTo: '2027-02-15', featured: true },
  { id: 'birthday-radiance', title: 'Birthday Radiance', subtitle: 'Chiếc bánh sinh nhật, những ngọn nến và lời chúc ấm áp.', theme: 'lilac', style: 'Tươi vui', category: 'Sinh nhật', price: 0, scenes: 3, effect: 'Thắp nến', creator: 'Momevia Originals' },
  { id: 'thank-you-bloom', title: 'Thank You Bloom', subtitle: 'Một bó hoa tinh tế thay lời biết ơn.', theme: 'sage', style: 'Thiên nhiên', category: 'Cảm ơn', price: 0, scenes: 3, effect: 'Hoa nở', creator: 'Momevia Originals' },
  { id: 'proud-of-you', title: 'Proud of You', subtitle: 'Dành cho cột mốc tốt nghiệp, thăng chức và thành công.', theme: 'navy', style: 'Thanh lịch', category: 'Chúc mừng', price: 0, scenes: 3, effect: 'Huy chương', creator: 'Momevia Originals' },
  { id: 'faraway-hug', title: 'Faraway Hug', subtitle: 'Mang lời nhớ tới người ở xa qua chiếc máy bay giấy.', theme: 'sky', style: 'Tình cảm', category: 'Bạn bè', price: 0, scenes: 3, effect: 'Máy bay giấy', creator: 'Momevia Originals' },
  { id: 'gentle-apology', title: 'Gentle Apology', subtitle: 'Một lời xin lỗi chân thành trong phong thư giấy mộc.', theme: 'cream', style: 'Tối giản', category: 'Xin lỗi', price: 0, scenes: 3, effect: 'Mở thư', creator: 'Momevia Originals' },
  { id: 'calm-light', title: 'Calm Light', subtitle: 'Lời động viên dịu dàng trong buổi bình minh.', theme: 'mint', style: 'Thiên nhiên', category: 'Động viên', price: 0, scenes: 3, effect: 'Ánh sáng', creator: 'Momevia Originals' },

].map(template => ({
  ...template,
  category: template.category || 'Sinh nhật',
  creatorId: 'system',
  status: 'published',
  createdAt: '2026-11-01T00:00:00.000Z',
}));
// Chỉ chèn mẫu hệ thống chưa tồn tại; không cập nhật đè giá, trạng thái hay snapshot cũ.
export const addedSystemTemplates = templates.filter(template => ['mot-ky-niem', 'hai-phong-bi'].includes(template.id) || template.isSeasonal || ['birthday-radiance', 'thank-you-bloom', 'proud-of-you', 'faraway-hug', 'gentle-apology', 'calm-light'].includes(template.id));
