// Dùng cùng một tuyến tạo thiệp ở trang chi tiết và hộp thoại xem thử.
// Encode từng thành phần để ID/phiên bản không làm sai đường dẫn hoặc query.
export function templateCreateUrl(template) {
  const id = String(template.id);
  const version = template.versionId
    ? `&version=${encodeURIComponent(String(template.versionId))}`
    : '';
  return `/create/${encodeURIComponent(id)}?mode=quick${version}`;
}
