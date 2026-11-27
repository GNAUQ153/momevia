import { createSignatureArtwork, signatureIds } from './art.js';
import { canonicalText } from '../../locale.js';

// ID thư viện độc lập với ID layer; mỗi lần chèn tạo bản sao mới từ artwork S1.
const keywords = Object.freeze({
  'secret-santa': 'christmas noel giáng sinh hộp quà ribbon gift',
  'midnight-soiree': 'midnight party tiệc tối phong thư envelope wax',
  'garden-tea': 'garden tea tiệc trà botanical cửa door',
  'last-chapter': 'graduation tốt nghiệp camera focus máy ảnh lấy nét',
  'graduation-mixtape': 'graduation tốt nghiệp retro polaroid máy ảnh photo',
  'graduation-countdown': 'graduation tốt nghiệp calendar lịch sticker disco',
});

export const signatureElementIds = Object.freeze(signatureIds.map(id => `signature-${id}`));

export function signatureLibraryCards(group) {
  return signatureIds.map(id => {
    const key = `signature-${id}`;
    return {
      id: key,
      title: canonicalText(`editor.library.item.${key}`),
      group,
      keywords: keywords[id],
      visualKind: 'graphics',
      create: () => createSignatureArtwork(id),
    };
  });
}
