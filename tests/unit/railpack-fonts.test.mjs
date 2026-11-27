import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Ảnh bìa Catalog được server vẽ từ SVG bằng sharp (librsvg + fontconfig).
// Container Linux trên Railway không có font: thiếu hai gói này thì chữ thành ô vuông.
test('Railway cài fontconfig và font có dấu tiếng Việt cho ảnh bìa vẽ ở server', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../../railpack.json', import.meta.url), 'utf8'));
  for (const name of ['fontconfig', 'fonts-dejavu-core']) {
    assert(config.deploy?.aptPackages?.includes(name), `railpack.json thiếu gói ${name}`);
  }
});
