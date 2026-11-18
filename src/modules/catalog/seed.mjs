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
].map(template => ({
  ...template,
  category: 'Sinh nhật',
  creatorId: 'system',
  status: 'published',
  createdAt: '2026-11-01T00:00:00.000Z',
}));
export const addedSystemTemplates = templates.filter(template => ['mot-ky-niem', 'hai-phong-bi'].includes(template.id));
