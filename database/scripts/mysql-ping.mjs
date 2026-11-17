import { loadEnvironment } from '../../src/shared/config.mjs';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';

loadEnvironment();
const client = new MySqlClient();
try {
  const [rows] = await client.execute('SELECT VERSION() AS version, DATABASE() AS db, @@session.time_zone AS timezone');
  console.log('MySQL kết nối thành công:', rows[0]);
} catch (error) {
  console.error('MySQL không kết nối được:', error.message);
  process.exitCode = 1;
} finally {
  await client.close();
}
