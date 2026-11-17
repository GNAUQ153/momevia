-- Chạy trên mysql database đã chọn, không dùng tiền tố schema PostgreSQL.
SELECT 'users' AS collection, COUNT(*) AS total_rows FROM users
UNION ALL SELECT 'sessions', COUNT(*) FROM sessions
UNION ALL SELECT 'templates', COUNT(*) FROM templates
UNION ALL SELECT 'favorites', COUNT(*) FROM favorites
UNION ALL SELECT 'gifts', COUNT(*) FROM gifts
UNION ALL SELECT 'replies', COUNT(*) FROM gift_replies
UNION ALL SELECT 'orders', COUNT(*) FROM orders
UNION ALL SELECT 'requests', COUNT(*) FROM support_requests
ORDER BY collection;
SELECT COUNT(*) AS demo_orders FROM orders WHERE is_test = 1;
SELECT COUNT(*) AS paid_template_entitlements FROM template_entitlements;
SELECT version, applied_at FROM schema_migrations ORDER BY applied_at;
