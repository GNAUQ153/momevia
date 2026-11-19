import { createElement } from "../../shared/canvas/registry.js";
import { interactionKinds } from "../../shared/canvas/interactions.js";

const ink = "#32243B", plum = "#633D77", rose = "#F0C4D2", lilac = "#DDD0FF";
const sage = "#BEDCCB", gold = "#F2D591", paper = "#FFF7EE", white = "#FFFFFF";

const layer = (type, x, y, width, height, props, name, options) => createElement(type, {
  name, layout: { x, y, width, height }, props, ...options,
});
const shape = (x, y, w, h, color, name, props = {}) => layer("shape", x, y, w, h, { color, ...props }, name);
const text = (x, y, w, h, value, name, props = {}, options = {}) => layer("text", x, y, w, h,
  { text: value, color: ink, fontSize: 20, ...props }, name, options);
const title = (x, y, w, h, value, props = {}) => text(x, y, w, h, value, "Tiêu đề", { fontToken: "serif", fontSize: 29, ...props },
  { accessibility: { role: "heading", level: 2 } });
const sticker = (id, x, y, width, height, color, name) => layer("sticker", x, y, width, height, { stickerId: id, color }, name);
const line = (x, y, w, h, pattern, name, color = plum, strokeWidth = 3) => layer("line", x, y, w, h, { color, strokeWidth, ...(pattern ? { pattern } : {}) }, name);
const rotate = (model, amount) => { model.layout.rotation = amount; return model; };
const centered = { align: "center" };

export const lettering = [
  ["quote-block", "Trích dẫn có ngoặc", () => [
    shape(0, 0, 328, 166, paper, "Giấy trích dẫn"),
    text(9, 0, 54, 75, "“", "Ngoặc mở", { color: plum, fontSize: 58, fontToken: "serif" }, { accessibility: { decorative: true } }),
    text(53, 38, 226, 70, "Những điều nhỏ làm nên ngày đẹp.", "Câu trích dẫn", { ...centered, fontToken: "serif" }),
    text(270, 50, 54, 75, "”", "Ngoặc đóng", { color: plum, fontSize: 58, fontToken: "serif" }, { accessibility: { decorative: true } }),
    text(62, 108, 205, 42, "— Một người bạn", "Tác giả", { ...centered, fontSize: 17 }),
  ], "ngoặc kép danh ngôn"],
  ["drop-cap", "Chữ cái mở đoạn", () => [
    shape(0, 0, 324, 154, paper, "Giấy thư"),
    text(18, 22, 288, 112, "Ngày ấy, bọn mình chỉ định gặp nhau một chốc, rồi quên cả thời gian.", "Đoạn mở thư", { dropCap: true, fontToken: "serif" }),
  ], "chữ đầu lớn thư"],
  ["postscript", "Lời tái bút", () => [
    text(0, 0, 56, 82, "P.S.", "Ký hiệu tái bút", { color: plum, fontToken: "serif", fontSize: 25 }),
    text(60, 4, 250, 82, "Nhớ giữ lại một điều vui cho ngày mai nhé.", "Lời tái bút"),
  ], "ghi chú cuối thư ps"],
  ["name-ribbon", "Ruy băng ghi tên", () => [
    shape(0, 0, 336, 76, lilac, "Hai đuôi ruy băng", { kind: "ribbon" }),
    shape(32, 5, 272, 64, rose, "Mặt ruy băng", { radius: 4 }),
    text(48, 19, 240, 42, "", "Tên trên ruy băng", { ...centered, textBinding: "recipientName", fontToken: "serif", fontSize: 25 }),
  ], "tên người nhận dải băng"],
  ["date-label", "Nhãn ngày kỷ niệm", () => [
    shape(0, 0, 158, 165, lilac, "Miếng lịch"),
    shape(0, 0, 158, 31, plum, "Gáy lịch"),
    text(12, 28, 134, 82, "19", "Ngày", { ...centered, fontSize: 58, fontToken: "serif" }),
    text(5, 109, 148, 46, "Tháng 11 · 2026", "Tháng và năm", { ...centered, fontSize: 17 }),
  ], "lịch tháng ngày năm"],
  ["spine-title", "Chữ gáy thiệp", () => [
    shape(0, 0, 64, 265, lilac, "Gáy sách"),
    rotate(title(-89, 109, 242, 48, "Những trang mình giữ", centered), -90),
  ], "tiêu đề dọc xoay sách"],
  ["sticky-note", "Giấy nhắn dán", () => [
    rotate(shape(5, 7, 246, 153, gold, "Giấy ghi chú", { radius: 3 }), -5),
    rotate(shape(82, 0, 95, 24, rose, "Băng giấy", { radius: 2 }), 6),
    rotate(text(24, 38, 205, 94, "Một điều vui cho hôm nay: có bạn!", "Lời nhắn", { fontToken: "serif", fontSize: 24 }), -5),
  ], "giấy nhớ note băng dán"],
  ["speech-bubble", "Bong bóng lời thoại", () => [
    shape(0, 0, 285, 135, sage, "Khung thoại", { kind: "speech" }),
    text(25, 15, 235, 82, "Này, có tin vui muốn kể!", "Lời thoại", { ...centered, fontSize: 24 }),
  ], "khung thoại hội thoại"],
  ["poem-card", "Thẻ thơ hai khổ", () => [
    shape(0, 0, 318, 267, paper, "Giấy thơ"),
    text(22, 18, 274, 38, "Gửi người hay mỉm cười", "Đề tặng", { ...centered, color: plum }),
    text(25, 68, 268, 70, "Ngày nghiêng một vạt nắng\nRơi vào trong bàn tay", "Khổ thơ đầu", { ...centered, fontToken: "serif" }),
    text(25, 158, 268, 70, "Gom làm lời nhắn nhỏ\nGửi bạn chiều hôm nay", "Khổ thơ sau", { ...centered, fontToken: "serif" }),
  ], "thơ đề tặng xuống dòng"],
  ["bilingual-note", "Lời nhắn song ngữ", () => [
    shape(0, 0, 342, 200, paper, "Giấy lời nhắn"),
    title(18, 10, 306, 48, "Gửi bạn · For you", centered),
    text(25, 65, 292, 56, "Cảm ơn vì đã luôn ở đó.", "Lời nhắn thứ nhất", centered),
    text(25, 125, 292, 56, "Thank you for always being there.", "Lời nhắn thứ hai", { ...centered, color: plum }),
  ], "hai ngôn ngữ tiếng Việt tiếng Anh"],
];

export const illustratedStickers = [
  ["ribbon-bow", "Nơ ruy băng", "#AC5478", "dải băng gói quà"],
  ["wax-seal", "Con dấu sáp", "#AC4262", "niêm thư đóng dấu"],
  ["paper-crane", "Hạc giấy", "#946EB5", "origami gấp chim"],
  ["butterfly", "Bươm bướm", "#AA6ABF", "cánh bướm"],
  ["sun", "Mặt trời", "#D9A23A", "nắng tia sáng"],
  ["crescent", "Trăng khuyết", "#D0A44A", "mặt trăng đêm"],
  ["rainbow", "Cầu vồng", "#B977AB", "nhiều màu vòng cung"],
  ["rain-cloud", "Mây mưa", "#95B5D4", "hạt mưa mây trời"],
  ["tea-cup", "Tách trà", "#B98564", "ly cốc hơi nước"],
  ["film-camera", "Máy ảnh phim", "#9676B3", "máy chụp hình cổ"],
  ["flower-bicycle", "Xe đạp giỏ hoa", "#AE587B", "xe hoa hai bánh"],
  ["birthday-candle", "Nến sinh nhật", "#C36D8C", "cây nến bánh"],
  ["lantern", "Đèn lồng Hội An", "#E29A55", "lồng đèn lễ hội"],
  ["sea-shell", "Vỏ sò", "#DBA896", "vỏ ốc biển"],
].map(([id, label, color, words]) => [id, label, () => [sticker(id, 0, 0, 96, 96, color, label)], words]);

function stationery(heading, fields, { color = paper, width = 336, height = 270 } = {}) {
  return [
    shape(0, 0, width, height, color, "Nền giấy"),
    title(18, 12, width - 36, 53, heading),
    ...fields.map(([y, value, name, props]) => text(20, y, width - 40, 54, value, name, props)),
  ];
}
const small = { fontSize: 17 };
const rows = (values, step, start = 70) => values.map(([value, label, props], i) => [start + step * i, value, label, props]);

export const stories = [
  ["three-milestones", "Dòng thời gian ba mốc", () => [
    shape(0, 0, 340, 360, paper, "Nền dòng thời gian"),
    title(18, 12, 304, 51, "Ba mốc mình nhớ"),
    shape(34, 73, 3, 244, plum, "Đường thời gian"),
    ...[["01.03", "Lần đầu gặp", "Mưa bỗng nhẹ đi."], ["18.06", "Chuyến đi đầu", "Cả hai lạc đường."], ["19.11", "Ngày hôm nay", "Vẫn còn nhiều chuyện để kể."]].flatMap(([date, event, note], i) => {
      const y = 77 + i * 86;
      return [shape(24, y, 22, 22, rose, "Chấm thời gian", { kind: "ellipse" }),
        text(54, y - 2, 70, 30, date, "Ngày", { ...small, color: plum }),
        text(122, y - 4, 202, 35, event, "Sự kiện"),
        text(54, y + 31, 270, 47, note, "Câu kể", small)];
    }),
  ], "sự kiện ngày kỷ niệm timeline"],
  ["diary-page", "Trang nhật ký", () => [
    ...stationery("Nhật ký · 19/11", [[78, "Hôm nay mình đi dạo. Có một góc phố làm mình nhớ tới bạn.", "Đoạn nhật ký"], [167, "Tâm trạng: dịu dàng", "Tâm trạng", {color:plum}]], {color:paper, height:240}),
    line(18, 71, 300, 4, null, "Dòng kẻ sổ", "#C1A9CE", 1),
  ], "sổ tay ngày tâm trạng"],
  ["date-ticket", "Vé hẹn gặp", () => [
    shape(0, 0, 326, 164, gold, "Giấy vé"),
    title(19, 12, 260, 39, "Hẹn bạn cuối tuần"),
    text(19, 72, 247, 38, "17:30 · Thứ bảy", "Giờ hẹn"),
    text(19, 110, 247, 40, "Quán nhỏ đầu phố", "Địa điểm"),
    rotate(line(226, 79, 145, 8, "stitched", "Đường xé dọc", plum, 2), 90),
  ], "vé giờ địa điểm cuộc hẹn"],
  ["friendship-recipe", "Công thức tình bạn", () =>
    stationery("Công thức tình bạn", rows([["Nguyên liệu", "Tiêu mục", {color:plum}], ["2 tách trà\n1 chuyện vui\nMột nhúm kiên nhẫn", "Nguyên liệu"], ["Lời dặn: dùng khi cần một người lắng nghe.", "Lời dặn"]], 55, 63), {color:sage, height:278}),
    "nấu ăn nguyên liệu lời dặn"],
  ["three-appreciations", "Ba điều mình quý ở bạn", () => [
    shape(0, 0, 338, 345, lilac, "Giấy cảm ơn"),
    title(16, 12, 306, 55, "Ba điều mình quý ở bạn", {fontSize:25}),
    ...[["Bạn lắng nghe", "Ngay cả khi mình kể hơi dài."], ["Bạn giữ lời", "Từ những điều nhỏ nhất."], ["Bạn làm ngày vui hơn", "Chỉ với một tin nhắn."]].flatMap(([heading, note], i) => {
      const y = 76 + i * 79;
      return [shape(13,y,39,39,paper,"Nền số",{kind:"ellipse"}),text(17,y+5,31,29,String(i+1),"Số thứ tự",centered),
        text(64,y,258,32,heading,"Điều trân trọng",{color:plum}),text(64,y+30,258,43,note,"Ví dụ",small)];
    }),
  ], "tri ân ghi nhận cảm ơn"],
  ["date-menu", "Thực đơn bữa hẹn", () =>
    stationery("Thực đơn · Bàn hai", rows([["Khai vị · Chuyện ở đầu ngày", "Món đầu", small], ["Món chính · Một bữa ấm", "Món chính", small], ["Tráng miệng · Cùng đi dạo", "Món cuối", small], ["Mời bạn ngồi cạnh mình.", "Lời mời", {color:plum}]], 45), {color:rose, height:274}),
    "món ăn bàn tiệc bữa tối"],
  ["journey-map", "Bản đồ hành trình", () => [
    shape(0, 0, 338, 235, sage, "Nền bản đồ"),
    title(16, 9, 306, 54, "Những nơi mình đã qua"),
    line(35, 78, 265, 92, "wave", "Đường nối hành trình"),
    ...[[34,119,"Nhà"],[146,119,"Ga nhỏ"],[265,119,"Bờ biển"]].flatMap(([x,y,place]) => [
      shape(x,y,20,20,rose,"Điểm đến",{kind:"ellipse"}),
      text(x-24,y+38,72,48,place,"Tên điểm đến",{...centered,...small}),
    ]),
  ], "sơ đồ điểm đến chuyến đi"],
  ["milestone-badge", "Huy hiệu cột mốc", () => [
    sticker("sunburst", 0, 0, 238, 238, gold, "Hoa thị"),
    shape(30, 30, 178, 178, paper, "Tâm huy hiệu", {kind:"ellipse"}),
    text(57, 39, 124, 75, "10", "Số cột mốc", {...centered,fontSize:56,fontToken:"serif"}),
    text(48, 112, 142, 36, "năm", "Đơn vị", {...centered,color:plum}),
    text(42, 149, 154, 52, "Cùng đi một đoạn", "Ghi công", {...centered,...small}),
  ], "hoa thị số năm thành tựu"],
];

export const geometry = [
  ["triangle", "Tam giác", () => [shape(0, 0, 124, 106, lilac, "Tam giác", {kind:"triangle"})], "cờ ba cạnh"],
  ["diamond", "Hình thoi", () => [shape(0, 0, 120, 126, rose, "Hình thoi", {kind:"diamond"})], "kim cương bốn cạnh"],
  ["hexagon", "Lục giác", () => [shape(0, 0, 120, 108, sage, "Lục giác", {kind:"hexagon"})], "sáu cạnh tổ ong"],
  ["arch-shape", "Hình vòm", () => [shape(0, 0, 152, 174, gold, "Hình vòm", {kind:"arch"})], "vòm bán nguyệt"],
  ...[
    ["arc-line", "Nét vòng cung", "arc", 220, 90, "cung hở nét cong"],
    ["stitched-line", "Đường chỉ may", "stitched", 235, 24, "nét đứt gạch may"],
    ["curved-arrow", "Mũi tên cong", "arrow", 168, 98, "chỉ hướng"],
    ["wave-line", "Nét lượn sóng", "wave", 242, 40, "đường lượn phân cách"],
    ["brace", "Ngoặc ôm đoạn", "brace", 36, 170, "ngoặc nhọn gom nhóm"],
    ["corner-frame", "Khung bốn góc hở", "corners", 245, 158, "góc vuông khung chữ L"],
  ].map(([id, label, pattern, width, height, words]) => [id, label, () => [line(0, 0, width, height, pattern, label)], words]),
];

const bulb = (x, y, i) => shape(x, y, 17, 26, [gold, rose, lilac, sage][i % 4], "Bóng đèn", {kind:"ellipse",strokeColor:plum,strokeWidth:1});
const bough = side => Array.from({length:6}, (_, i) => {
  const x = 13 + i*i*1.75;
  return rotate(sticker("leaf", side ? 230-x : x, 17+i*28, 48, 36, i%2 ? "#55886D" : "#699A81", "Lá nguyệt quế"), side ? 145-i*15 : -80+i*15);
});
const hangingLantern = (x,y,i) => sticker("lantern", x, y, 50, 71, ["#E29A55", "#BE5C7A", "#A17DD5"][i % 3], "Lồng đèn");
export const decorations = [
  ["string-lights", "Dây đèn treo", () => [
    rotate(line(0, 0, 320, 51, "arc", "Dây đèn", plum, 2), 180),
    ...[8, 28, 42, 47, 42, 28, 8].map((y,i) => bulb(9+i*47, y, i)),
  ], "bóng đèn dây võng"],
  ["laurel-wreath", "Vòng nguyệt quế", () => [...bough(0), ...bough(1)], "vòng lá vinh danh"],
  ["balloon-arch", "Vòm bóng bay", () => [
    ...[[0,102,70],[26,58,76],[57,20,74],[116,1,63],[174,10,73],[222,39,75],[254,81,71]].map(([x,y,w],i) =>
      shape(x, y, w, w*1.16, [rose, gold, lilac, sage][i%4], "Bóng bay", {kind:"ellipse",strokeColor:paper,strokeWidth:2})),
  ], "cổng vòm chùm bóng sinh nhật"],
  ["washi-corners", "Góc dán washi", () => [
    rotate(sticker("washi-tape", 1, 18, 96, 32, gold, "Washi sọc vàng"), -28),
    rotate(sticker("washi-tape", 20, 22, 85, 29, rose, "Washi hồng"), -11),
    rotate(sticker("washi-tape", 214, 121, 96, 32, lilac, "Washi tím"), -29),
    rotate(sticker("washi-tape", 199, 115, 85, 29, sage, "Washi xanh"), -8),
  ], "băng giấy dán góc ảnh"],
  ["layered-waves", "Sóng biển nhiều lớp", () => [
    sticker("paper-wave", 0, 0, 335, 103, "#B8DCEF", "Sóng xa"),
    sticker("paper-wave", 0, 39, 335, 66, "#6AAACB", "Sóng giữa"),
    sticker("paper-wave", 0, 67, 335, 40, "#3E789D", "Sóng gần"),
  ], "mảng sóng nước chân thiệp"],
  ["lantern-street", "Phố đèn lồng", () => [
    rotate(line(0, 0, 332, 41, "arc", "Dây trên", plum, 2), 180),
    rotate(line(22, 32, 295, 39, "arc", "Dây dưới", plum, 2), 180),
    ...[[3,4],[56,35],[105,44],[157,61],[220,38],[279,17]].map(([x,y],i) => hangingLantern(x,y,i)),
  ], "hội an dây treo lễ hội"],
  ["wrapped-bouquet", "Bó hoa gói giấy", () => [
    rotate(shape(28, 78, 202, 176, "#EBC69F", "Giấy gói ngoài", {kind:"triangle"}), 180),
    rotate(shape(77, 91, 115, 149, "#F7DBC4", "Giấy gói trong", {kind:"triangle"}), 169),
    ...[[-37,81,19],[3,98,7],[39,125,-23]].map(([dx,y,angle]) => rotate(shape(123+dx, y, 5, 121, "#4F8568", "Thân hoa"), angle)),
    ...[[33,51],[73,14],[120,22],[162,47],[124,65]].map(([x,y],i) => sticker("flower",x,y,78,78,["#A34E6D","#8A60AA","#BE7B30"][i%3],"Bông hoa")),
    sticker("ribbon-bow", 94, 170, 78, 70, "#BD5473", "Nơ bó hoa"),
  ], "hoa quà tri ân nơ giấy gói"],
  ["lace-border", "Viền ren quanh thiệp", () => [
    sticker("lace",0,0,328,29,plum,"Ren trên"),sticker("lace",0,216,328,29,plum,"Ren dưới"),
    rotate(sticker("lace",-104,112,237,25,plum,"Ren trái"),90),
    rotate(sticker("lace",195,112,237,25,plum,"Ren phải"),-90),
  ], "khung ren họa tiết lặp"],
  ["birthday-table", "Bàn tiệc sinh nhật", () => [
    sticker("bunting",0,0,320,62,"#B785CB","Cờ dây"),
    shape(30,169,260,22,"#A76E7D","Mặt bàn"),
    shape(46,188,228,62,rose,"Khăn phủ bàn"),
    shape(90,145,144,34,lilac,"Đĩa bánh",{kind:"ellipse"}),
    sticker("cake",109,77,107,90,plum,"Bánh sinh nhật"),
    sticker("birthday-candle",132,62,31,57,"#AE5278","Nến trái"),
    sticker("birthday-candle",167,54,31,57,"#AA763C","Nến phải"),
  ], "bàn bánh sinh nhật tiệc nến"],
];

const photo = (x, y, width, height, name, caption = "", mask) => layer("image", x, y, width, height, {
  optional: true, caption, radius: 4, ...(mask ? { mask } : {}),
}, name, { accessibility: { label: name, alt: name } });

export const photoLayouts = [
  ["round-portrait", "Chân dung tròn", () => [photo(0, 0, 198, 198, "Ảnh chân dung", "", "round")], "ảnh tròn khuôn mặt"],
  ["arch-photo", "Ảnh vòm cửa", () => [
    shape(0, 0, 226, 258, lilac, "Viền vòm", {kind:"arch"}),
    photo(8, 8, 210, 242, "Ảnh vòm", "", "arch"),
  ], "mặt nạ cửa khung ảnh"],
  ["heart-photo", "Ảnh trái tim", () => [photo(0, 0, 226, 207, "Ảnh trái tim", "", "heart")], "hình tim mặt nạ ảnh"],
  ["film-strip", "Dải phim ba ảnh", () => [
    shape(0, 0, 226, 487, ink, "Cuộn phim", {radius:8}),
    ...Array.from({length:13}, (_, i) => [9,205].map(x => shape(x, 10 + 36*i, 12, 16, paper, "Lỗ cuộn phim", {radius:2}))).flat(),
    ...["Khoảnh khắc đầu", "Khoảnh khắc giữa", "Khoảnh khắc cuối"].map((caption,i) => photo(28, 11 + 158*i, 170, 148, `Ảnh phim ${i+1}`, caption)),
  ], "cuộn phim ba ô ảnh dọc"],
  ["photo-diptych", "Ảnh đôi trước và sau", () => [
    shape(0, 0, 336, 186, white, "Giấy ảnh đôi"),
    photo(8, 8, 156, 170, "Ảnh trước", "Trước đây"),
    photo(172, 8, 156, 170, "Ảnh sau", "Bây giờ"),
  ], "ghép cặp ảnh song song thời điểm"],
  ["photo-postcard", "Bưu thiếp ảnh", () => [
    shape(0, 0, 343, 218, paper, "Giấy bưu thiếp", {strokeColor:rose,strokeWidth:2}),
    photo(8, 9, 138, 200, "Ảnh bưu thiếp"),
    shape(152, 12, 2, 194, rose, "Nếp bưu thiếp"),
    shape(284, 14, 45, 56, lilac, "Ô tem"),
    sticker("sun", 291, 24, 30, 35, "#AD7731", "Tem"),
    text(164, 24, 116, 43, "Đà Lạt", "Địa danh", {fontToken:"serif",fontSize:26}),
    text(164, 83, 165, 124, "Mình gửi bạn một chút gió và một chiều thật đẹp.", "Thư bưu thiếp", {fontSize:17}),
  ], "ảnh bưu điện địa danh thư tem"],
  ["magazine-cover", "Bìa tạp chí cá nhân", () => [
    shape(0, 0, 311, 394, white, "Giấy tạp chí"),
    photo(9, 9, 293, 376, "Ảnh bìa chính"),
    shape(9, 9, 293, 111, paper, "Dải tên tạp chí", {radius:0}),
    title(20, 14, 271, 66, "Kỷ niệm", {...centered,fontSize:46}),
    text(19, 83, 274, 32, "", "Tên người nhận trên bìa", {...centered,fontSize:20,textBinding:"recipientName"}),
    shape(17, 271, 277, 96, ink, "Nền dòng tít", {radius:3}),
    text(29, 280, 252, 38, "Một số đặc biệt", "Tít thứ nhất", {color:white}),
    text(29, 320, 252, 38, "Chuyện của hai ta", "Tít thứ hai", {color:white}),
  ], "ảnh tạp chí dự chân dung bìa tít"],
  ["panorama-caption", "Ảnh toàn cảnh có chú thích", () => [
    photo(0, 0, 346, 190, "Ảnh toàn cảnh", "Chiều hôm ấy, cả bầu trời đổi màu."),
  ], "ảnh ngang rộng ảnh phong cảnh caption"],
  ["quad-album", "Album bốn ô", () => [
    shape(0, 0, 336, 336, lilac, "Nền album"),
    ...["Ngày đầu", "Giữa đường", "Bên nhau", "Mãi nhớ"].map((caption,i) => photo(8 + 163*(i%2), 8 + 163*Math.floor(i/2), 157, 157, `Ảnh album ${i+1}`, caption)),
  ], "lưới ghép ảnh hai hai 4 bốn ảnh"],
  ["torn-photo", "Ảnh mép giấy xé", () => [
    shape(0, 0, 271, 203, paper, "Giấy nền ảnh"),
    photo(5, 7, 261, 189, "Ảnh mép xé", "", "torn"),
  ], "viền rách giấy bất quy tắc"],
  ["hero-collage", "Ảnh ghép một lớn hai nhỏ", () => [
    shape(0, 0, 348, 241, lilac, "Nền ghép ảnh"),
    photo(7, 7, 187, 227, "Ảnh chính"),
    photo(200, 7, 141, 110, "Ảnh phụ phía trên"),
    photo(200, 124, 141, 110, "Ảnh phụ phía dưới"),
  ], "collage ảnh ghép ảnh chính ảnh phụ"],
];

const interaction = (kind, color, entries, extras = {}) => () => {
  const spec = interactionKinds[kind];
  const [width, height] = spec.size;
  const props = {kind, color, ...extras};
  if (entries) props.entries = entries.map(([heading, body]) => body === undefined ? {heading} : {heading, body});
  if (spec.slots) props.photos = Array.from({length:spec.slots}, (_, i) => ({
    id: `photo-${i+1}`, assetId: null, alt: "", caption: "", focalPoint: {x:.5,y:.5},
  }));
  const options = spec.targets ? {actions: Array.from({length:spec.targets}, () => ({
    on: "activate", type: "goToScene", targetSceneId: null,
  }))} : {};
  return [layer("interaction", 0, 0, width, height, props, spec.label, options)];
};

export const interactions = [
  ["flip-card", rose, [["Bạn đoán mình nhớ điều gì nhất?", "Mình nhớ những buổi chiều nghe bạn kể chuyện."]], "lật trước sau câu hỏi hai mặt"],
  ["scratch-ticket", lilac, [["Cào để mở bí mật", "Hẹn nhau ở quán nhỏ cuối phố nhé!"]], "cào vé bí mật mở ngay"],
  ["foldout-letter", paper, [["Khi mình gặp nhau", "Mình còn nhớ đúng buổi chiều ấy."],
    ["Điều mình muốn nói", "Cảm ơn vì bạn luôn dành thời gian."], ["Lời nhắn cuối", "Mong mình sớm gặp lại nhau."]], "thư xếp accordion nếp mở"],
  ["swipe-album", sage, null, "ảnh album cuộn thư viện hình trượt"],
  ["photo-comparison", lilac, null, "so ảnh trước sau thanh trượt"],
  ["scene-choices", lilac, [["Một ngày mưa"], ["Một ngày nắng"]], "rẽ nhánh hai nút cảnh đích"],
  ["wish-pick", gold, [["Bình yên", "Chúc bạn mỗi ngày có chút thời gian cho mình."], ["Niềm vui", "Chúc bạn có nhiều điều nhỏ để mỉm cười."],
    ["Can đảm", "Chúc bạn bắt đầu điều mình vẫn mong làm."]], "ba lựa chọn lời chúc"],
  ["light-a-candle", paper, [["Thắp nến", "Chúc điều bạn ước sẽ thành hiện thực."]], "lửa nến sinh nhật lời ước"],
  ["heart-puzzle", rose, [["Xem lời nhắn ngay", "Mỗi mảnh đều nhắc mình tới bạn."]], "xếp hình trái tim mảnh ghép"],
  ["event-countdown", sage, [["Hẹn bạn ở đó", "Đến giờ gặp nhau rồi!"]], "thời gian giờ hẹn ngày múi giờ",
    {eventAt:null,timeZone:"Asia/Ho_Chi_Minh"}],
].map(([id, color, entries, words, extras]) => [id, interactionKinds[id].label, interaction(id, color, entries, extras), words]);
