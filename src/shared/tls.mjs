import fs from 'node:fs';
import { createSecureContext } from 'node:tls';

// Read once at startup. Invalid or incomplete TLS must never fall back to HTTP.
export function loadTlsOptions(config) {
  const certFile = config.httpsCertFile || '';
  const keyFile = config.httpsKeyFile || '';
  if (!certFile && !keyFile) return null;
  if (!certFile || !keyFile) throw new Error('HTTPS cần cả HTTPS_CERT_FILE và HTTPS_KEY_FILE.');
  if (!config.baseUrl?.startsWith('https://')) throw new Error('PUBLIC_BASE_URL phải là HTTPS khi nạp chứng chỉ trực tiếp.');
  const options = { cert: fs.readFileSync(certFile), key: fs.readFileSync(keyFile), minVersion: 'TLSv1.2' };
  createSecureContext(options);
  return options;
}
