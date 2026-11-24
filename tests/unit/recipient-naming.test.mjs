import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import readExcel from 'read-excel-file/node';
import { unzipSync, strFromU8 } from 'fflate';
import { recipientWorkbook } from '../../src/modules/gifts/recipient-workbook.mjs';
import { recipientCsv } from '../../web/js/shared/recipient-naming.js';
import { parseRecipientCsv, recipientRowsPreview, readRecipientFile } from '../../web/js/features/gifts/recipient-import.js';
import { resolveText } from '../../web/js/features/gift-runtime/renderer.js';

test('Excel export preserves formula-like names, punctuation, duplicate rows and long invited URLs as string cells', async () => {
  const url='https://gift.example.test/g/opaque?r=opaque&invite=preserved&long='+('abc'.repeat(1500));
  const names=['=SUM(1,2)','+Nguyễn "Mai", Anh','@Lan & Minh','-Trần Đặng','Lan','Lan'];
  const rows=names.map((name,i)=>({id:`receipt-${i}`,row:i+2,name,url:url+i}));
  const workbook=recipientWorkbook(rows), cells=await readExcel(workbook);
  assert.equal(cells.length,7);
  for(const [i,row] of cells.slice(1).entries()){assert.equal(row[0],names[i]);assert.equal(row[1],url+i);assert.equal(row[3],rows[i].id);}
  const xml=strFromU8(unzipSync(workbook)['xl/worksheets/sheet1.xml']);
  assert(!xml.includes('<f>'));assert(!xml.includes('<f '));
  const csv=parseRecipientCsv(recipientCsv(rows));
  assert.equal(csv[1].cells[0],"'=SUM(1,2)");assert.equal(csv[1].cells[1],url+0);
});
test('CSV reports original physical rows, rejects malformed quotes and invalid UTF-8, and never hides a bad last row', async () => {
  const sample=recipientRowsPreview(parseRecipientCsv(fs.readFileSync(new URL('../../web/assets/recipient-template.csv',import.meta.url),'utf8')));
  assert.equal(sample.names.length,3);assert.equal(sample.errors.length,0);assert.equal(sample.names[0].name,sample.names[2].name);
  const result=recipientRowsPreview(parseRecipientCsv('Tên người nhận,other\r\nLan,"a\r\nb"\r\nLan,ok\r\n"",last'));
  assert.deepEqual(result.names.map(r=>r.row),[2,4]);assert.deepEqual(result.errors.map(r=>r.row),[5]);
  assert.throws(()=>parseRecipientCsv('Tên người nhận\n"unclosed'),/recipient.error.csv/);
  assert.throws(()=>recipientRowsPreview(parseRecipientCsv('Wrong\nLan')),/recipient.error.header/);
  await assert.rejects(readRecipientFile({name:'bad.csv',size:2,arrayBuffer:async()=>Uint8Array.from([0xff,0xff]).buffer}),/recipient.error.utf8/);
});
test('Only versioned new documents interpolate the supported token; preview names never become recipient identity', () => {
  const doc={bindings:{recipientName:{value:'Lan'},message:{value:'Gửi {người nhận} · {unknown}'}}};
  const literal={props:{text:'Gửi {người nhận} · {unknown}'}};
  assert.equal(resolveText(literal,doc),'Gửi {người nhận} · {unknown}');
  doc.personalization={version:1,mode:'self'};
  assert.equal(resolveText(literal,doc),'Gửi Mai Anh · {unknown}');
  assert.equal(doc.bindings.recipientName.value,'Lan');
  doc.personalization.resolved=true;
  assert.equal(resolveText(literal,doc),'Gửi Lan · {unknown}');
  assert.equal(resolveText({props:{textBinding:'message'}},doc),'Gửi Lan · {unknown}');
});
