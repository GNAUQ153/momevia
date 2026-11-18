export async function confirmGiftAccess(page, { open = 'link', send = 'link', read = 'link' } = {}) {
  const dialog = page.getByRole('dialog', { name: 'Quyền truy cập món quà' });
  await dialog.getByLabel('Ai được mở quà?').selectOption(open);
  await dialog.getByLabel('Ai được gửi hồi đáp?').selectOption(send);
  await dialog.getByLabel('Ai được đọc hồi đáp?').selectOption(read);
  await dialog.getByRole('button', { name: 'Xuất bản và lấy link' }).click();
}
