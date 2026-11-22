// Hạn chế chuyển động nặng khi người dùng bật tiết kiệm dữ liệu.
// Không bắt buộc trình duyệt phải hỗ trợ Network Information API.
export function marketingDataSaverEnabled({ reducedData = false, saveData = false } = {}) {
  return Boolean(reducedData || saveData);
}

export function marketingConnection(navigatorObject = globalThis.navigator) {
  return navigatorObject?.connection || navigatorObject?.mozConnection || navigatorObject?.webkitConnection || null;
}

export function marketingShouldShowStatic({ reducedMotion = false, reducedData = false, saveData = false } = {}) {
  return Boolean(reducedMotion || marketingDataSaverEnabled({ reducedData, saveData }));
}
