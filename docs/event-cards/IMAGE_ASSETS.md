# Hình ảnh ba thiệp

Tạo bằng công cụ imagegen tích hợp ngày 21/11/2026, theo góp ý bổ sung ảnh thực tế. Đây là hình tổng hợp bằng AI theo phong cách chụp sản phẩm, không phải ảnh chụp sự kiện/người dùng thật. Không có tên, lời chúc, logo, watermark hoặc nội dung cá nhân trong ảnh. Chữ và hành động vẫn là element riêng trong Canvas.

| Ảnh | Tệp trong workspace | SHA-256 | Kích thước / dung lượng |
|---|---|---|---|
| Bánh kem/nến | `web/assets/event-cards/birthday-859492553d0a.webp` | `859492553d0a27f9f1a5461b5601c23b83f3e43eb7c2511d7dc920351f38fb34` | 1024 × 683, 149.238 byte |
| Phong bì/dấu sáp | `web/assets/event-cards/wedding-09fd28f280bf.webp` | `09fd28f280bfa9b53486e76dae3b0e74e596be354e3e9ca289cf3732fddeeaf9` | 1024 × 603, 164.730 byte |
| Mũ/bằng tốt nghiệp | `web/assets/event-cards/graduation-512d1917294b.webp` | `512d1917294b43016d3502e82133a2b1fcf463eea8884bfceb439aaad28148f9` | 1024 × 683, 135.662 byte |

Các ảnh đều giữ kênh alpha. File có hash trong tên là bất biến; thay ảnh sau này cần tên mới và phiên bản bìa mới. Ảnh được dùng lại làm chi tiết nhỏ ở các cảnh sau. Hai phong bì cưới là hai element image độc lập dùng cùng nguồn ảnh.

## Prompt sinh nhật

Use case: photorealistic-natural. Asset type: transparent photographic cutout for an editable birthday greeting card, not a complete card. Subject: a joyful real artisan birthday cake viewed slightly above table height, creamy ivory buttercream with coral piped frosting, tiny golden sprinkles, three slender teal birthday candles with warm small flames, sitting on a real turquoise glazed ceramic plate. A few naturally scattered curled coral and yellow paper confetti beside the plate. Real delicious textures, tactile frosting, soft natural window light, subtle soft contact shadow. Entire cake, flames and plate visible with generous transparent margin. Horizontal composition, isolated object, high quality food photography, front/three-quarter view. Palette coral #F56C60, teal #41BCAF, golden yellow #FFD056, cream. No people, hands, text, letters, numbers, logo, watermark, drawn outlines, vector art, cartoon or flat geometric illustration. Genuine alpha transparent background. Intended to occupy the center of a 390px mobile card while all wording remains separate editable text.

## Prompt đám cưới

Use case: photorealistic-natural. Asset type: transparent photographic cutout for a young joyful wedding congratulations card. A single beautiful real ivory cotton-paper envelope, closed with a rich raspberry red handmade wax seal, gently curved sage green silk ribbon loosely wrapped around it, a tiny botanical sprig with two delicate white blossoms tucked beside the seal. Slightly overhead camera angle, envelope mostly front-facing, horizontal proportion about 1.7:1. Show tactile paper fibers, real wax imperfections, satin silk sheen, soft natural daylight and a soft contact shadow. Entire object fully visible with transparent margins. The image will be reused as TWO separate editable envelope layers with separate text/button labels placed outside it, so absolutely NO words, no calligraphy, no labels, no handwriting, no logos, no watermarks. No people or hands, no flat vector shapes, no cartoon, no table or opaque backdrop. Genuine alpha transparent background. Palette ivory #FFF8EB, raspberry #963851, botanical green #47715C. Lifelike editorial wedding stationery photography.

## Prompt tốt nghiệp

Use case: photorealistic-natural. Asset type: transparent photographic cutout for an editable graduation congratulations card, not an entire card. Subject: a real dark midnight navy graduation mortarboard cap in a lively floating diagonal three-quarter angle, with a long rich golden yellow silk tassel gently curving down to the right. Beside and slightly below the cap is a small real ivory rolled diploma tied with a coral red satin ribbon. Entire cap, tassel and diploma visible. Show tactile woven fabric, crisp authentic square cap board, silk tassel strands and lightly textured parchment, soft natural studio light with subtle dimensional shadows. Isolated on a genuinely transparent alpha background. Joyful youthful celebratory editorial photography. Palette midnight navy #172849, gold #FFC857, ivory #FFF8E7 and coral #F78A79. Horizontal composition, clear recognizable silhouette when small, generous transparent margins, no people or hands. No text or numbers on diploma, no logos, no watermarks, no cartoon, no vector or flat geometry, no opaque background. All card words and the recipient name will be separate editable elements.
