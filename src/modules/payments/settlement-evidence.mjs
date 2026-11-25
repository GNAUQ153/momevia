// Chỉ chấp nhận số nguyên hoặc chuỗi số rõ ràng, không ép null/false thành 0.
export function providerInteger(value) {
  if (typeof value !== 'number' && !(typeof value === 'string' && /^\d+$/.test(value))) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}

// Mã giao dịch là chuỗi nguyên vẹn, không tự cắt hoặc chuẩn hóa mã từ provider.
export function paymentReference(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 191
    && value.trim() === value && !/[\x00-\x1f\x7f]/.test(value);
}
