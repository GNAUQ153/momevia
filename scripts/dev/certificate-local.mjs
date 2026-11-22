import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { X509Certificate, createPrivateKey } from 'node:crypto';
import { fileURLToPath } from 'node:url';

export function opensslBinary() {
  const candidates = process.env.OPENSSL_BIN ? [process.env.OPENSSL_BIN] : ['openssl',
    ...(process.platform === 'win32' ? [path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Git', 'usr', 'bin', 'openssl.exe')] : [])];
  for (const candidate of candidates) if (spawnSync(candidate, ['version'], { windowsHide:true, stdio:'ignore' }).status === 0) return candidate;
  throw new Error('Cần OpenSSL để tạo chứng chỉ thử localhost; có thể đặt OPENSSL_BIN. Chứng chỉ thật dùng HTTPS_CERT_FILE/HTTPS_KEY_FILE.');
}
export function localCertificate(directory) {
  const certFile = path.resolve(directory, 'localhost-cert.pem');
  const keyFile = path.resolve(directory, 'localhost-key.pem');
  if (fs.existsSync(certFile) !== fs.existsSync(keyFile)) throw new Error('Thiếu một tệp chứng chỉ/khóa localhost. Không tự ghi đè tệp còn lại.');
  if (!fs.existsSync(certFile)) {
    fs.mkdirSync(directory, { recursive:true, mode:0o700 });
    const result = spawnSync(opensslBinary(), ['req','-x509','-newkey','rsa:2048','-sha256','-nodes',
      '-keyout',keyFile,'-out',certFile,'-days','30','-subj','/CN=localhost',
      '-addext','subjectAltName=DNS:localhost,IP:127.0.0.1'], { windowsHide:true, encoding:'utf8' });
    if (result.status !== 0) throw new Error('Không tạo được chứng chỉ localhost bằng OpenSSL.');
    fs.chmodSync(keyFile,0o600);
  }
  const cert = new X509Certificate(fs.readFileSync(certFile));
  if (!cert.checkPrivateKey(createPrivateKey(fs.readFileSync(keyFile))) || !cert.checkHost('localhost') || !cert.checkIP('127.0.0.1'))
    throw new Error('Chứng chỉ localhost không khớp khóa hoặc địa chỉ.');
  if (Date.parse(cert.validTo) <= Date.now()) throw new Error('Chứng chỉ thử localhost đã hết hạn. Chọn thư mục chứng chỉ mới để tạo lại.');
  return { certFile,keyFile,validTo:cert.validTo };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root=fileURLToPath(new URL('../../',import.meta.url));
  const cert=localCertificate(path.join(root,'local','certificates'));
  console.log(`Chứng chỉ localhost: ${cert.certFile}\nHết hạn: ${cert.validTo}\nChỉ dùng thử trên máy; chưa cài vào kho tin cậy của hệ điều hành.`);
}
