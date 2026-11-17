// Chỉ chạy trước khi mở cổng HTTP; dùng repository và hash của Identity hiện tại.
export async function provisionTestAccount(credentials, account) {
  if (!account) return null;
  const existing = credentials.repository.all().find(user => user.email?.toLowerCase() === account.email);
  if (existing) {
    if (existing.provider !== 'email' || existing.testAccount?.source !== 'env') {
      throw new Error('TEST_ACCOUNT_EMAIL đã thuộc tài khoản khác; không ghi đè dữ liệu.');
    }
    return existing;
  }
  const user = await credentials.register(account);
  return credentials.repository.update(user.id, {
    role: account.role,
    testAccount: { source: 'env' },
  });
}
