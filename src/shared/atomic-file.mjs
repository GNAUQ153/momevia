import fs from 'node:fs';

// Windows có thể tạm khóa tệp JSON khi antivirus hoặc tiến trình khác truy cập.
// Không xóa tệp đích trước khi đổi tên, nhằm giữ thao tác commit nguyên tử.
const RENAME_RETRY_CODES = new Set(['EPERM', 'EACCES', 'EBUSY']);
const RENAME_RETRY_DELAYS = [25, 50, 100, 150];
const sleepState = new Int32Array(new SharedArrayBuffer(4));

export function replaceFileWithRetry(source, destination) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      fs.renameSync(source, destination);
      return;
    } catch (error) {
      if (!RENAME_RETRY_CODES.has(error?.code) || attempt >= RENAME_RETRY_DELAYS.length) {
        throw error;
      }
      // Các repository đang ghi đồng bộ; tổng thời gian chờ tối đa 325 ms.
      Atomics.wait(sleepState, 0, 0, RENAME_RETRY_DELAYS[attempt]);
    }
  }
}
