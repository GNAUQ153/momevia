// Natural v2 is a frozen release; later element behavior is a separate CAS update.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
const pins=[{"file":"template-refresh-natural-20261123-v2.json","sha256":"f4aae536594d8a24b07cc18263667252c478b91f3de3185f3c94328024d4b759"},{"file":"template-refresh-natural-20261123-v2-from-vector-v1.json","sha256":"42a6c4d4164beca0a74f8e8851cc6c747a9f26c9bbf0b6d270733bc132d385ea"}];
for(const {file,sha256}of pins)if(createHash('sha256').update(fs.readFileSync('database/updates/'+file)).digest('hex')!==sha256)throw new Error('Frozen natural v2 bundle changed: '+file);
console.log('PASS immutable natural v2 releases. Use natural-motion-bundle.mjs for motion updates.');
