import { DRIVE_BLOCKS } from './drive-elements.js';
export const interactionKinds = Object.freeze({
  ...Object.fromEntries(DRIVE_BLOCKS.map(([id,label,,clock,slots])=>[id,{label,drive:true,icon:'✦',size:[338,450],fields:Array.from({length:id==='four-choice-quiz'?4:1},()=>['Nhãn','Nội dung']),...(clock?{clock:true}:{}),...(slots?{slots,minimumPhotos:0}: {})}])),
  "prediction-choice": { label: "Tớ đoán cậu sẽ chọn…", prediction: true, icon: "?", size: [342, 550] },
  "flip-card": { label: "Thẻ lật hai mặt", fields: [["Mặt trước", "Mặt sau"]], icon: "↺", size: [320, 178] },
  "scratch-ticket": { label: "Vé cào bật mí", fields: [["Nhãn lớp phủ", "Lời bật mí"]], icon: "✦", size: [326, 196] },
  "foldout-letter": { label: "Thư gấp ba nếp", fields: Array.from({length:3}, (_, i) => [`Tên nếp ${i+1}`, `Nội dung nếp ${i+1}`]), icon: "▤", size: [336, 230] },
  "swipe-album": { label: "Album vuốt ngang", slots: 3, minimumPhotos: 1, icon: "▧", size: [337, 310] },
  "photo-comparison": { label: "Thanh kéo so sánh ảnh", slots: 2, minimumPhotos: 2, icon: "◫", size: [337, 304] },
  "scene-choices": { label: "Hai cửa chọn câu chuyện", fields: [["Nhãn cửa thứ nhất"], ["Nhãn cửa thứ hai"]], targets: 2, icon: "▯", size: [332, 180] },
  "wish-pick": { label: "Chọn một điều ước", fields: Array.from({length:3}, (_, i) => [`Lựa chọn ${i+1}`, `Lời chúc ${i+1}`]), icon: "✧", size: [334, 182] },
  "light-a-candle": { label: "Chạm thắp nến", fields: [["Nhãn nút", "Lời ước"]], icon: "✧", size: [230, 187] },
  "heart-puzzle": { label: "Ghép ba mảnh tim", fields: [["Nhãn mở ngay", "Lời nhắn"]], icon: "♥", size: [293, 199] },
  "event-countdown": { label: "Đồng hồ đếm ngược tới hẹn", fields: [["Tên cuộc hẹn", "Lời chúc khi tới hẹn"]], clock: true, icon: "◷", size: [325, 186] },
});

export const photoSlots = element => {
  if (element.type === 'image') return [element.props];
  if (element.type === 'interaction') return element.props.photos || [];
  return [];
};

const timeFormat = zone => new Intl.DateTimeFormat('en-CA', {
  timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});
export function localEventTime(iso, zone) {
  const {year,month,day,hour,minute} = Object.fromEntries(timeFormat(zone)
    .formatToParts(new Date(iso)).map(({type,value}) => [type,value]));
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

export function eventTimeFromLocal(value, zone) {
  const wall = Date.parse(value + ':00Z');
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value) || !Number.isFinite(wall))
    throw new Error('Nhập ngày và giờ hẹn hợp lệ.');
  const offsets = new Set();
  for (const hours of [-24, 0, 24]) {
    const sample = wall + hours * 3600000;
    offsets.add(Date.parse(localEventTime(sample, zone) + ':00Z') - sample);
  }
  // When a DST hour repeats, take the first occurrence.
  const matches = [...offsets].map(offset => wall - offset)
    .filter(candidate => localEventTime(candidate, zone) === value).sort((a,b) => a-b);
  if (!matches.length) throw new Error('Giờ này không tồn tại trong múi giờ đã chọn.');
  return new Date(matches[0]).toISOString();
}
