-- Báo cáo số bản ghi để đối chiếu với log của công cụ db:prepare.
SELECT 'users' AS collection, COUNT(*) AS rows FROM app.users
UNION ALL SELECT 'sessions', COUNT(*) FROM app.sessions
UNION ALL SELECT 'templates', COUNT(*) FROM app.templates
UNION ALL SELECT 'favorites', COUNT(*) FROM app.favorites
UNION ALL SELECT 'gifts', COUNT(*) FROM app.gifts
UNION ALL SELECT 'replies', COUNT(*) FROM app.gift_replies
UNION ALL SELECT 'orders', COUNT(*) FROM app.orders
UNION ALL SELECT 'requests', COUNT(*) FROM app.support_requests
ORDER BY collection;

-- Đơn hàng cũ chỉ là demo: không tạo quyền mua hàng thật từ các dòng này.
SELECT COUNT(*) AS old_demo_orders FROM app.orders WHERE is_test = TRUE;
SELECT COUNT(*) AS real_entitlements FROM app.template_entitlements;
SELECT version, applied_at FROM app.schema_migrations ORDER BY applied_at;
