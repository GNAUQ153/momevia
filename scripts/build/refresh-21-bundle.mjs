import fs from 'node:fs';import {createHash} from 'node:crypto';import {validateRollout} from '../../src/modules/designs/library-rollout.mjs';
const file='database/updates/template-refresh-21-20261123-v1.json',bytes=fs.readFileSync(file),bundle=JSON.parse(bytes);validateRollout(bundle);
const expected='f368d75b7e38c578c3b11018c05b619495299d9c35590e40c305e6a53f4721dc',actual=createHash('sha256').update(bytes).digest('hex');if(actual!==expected)throw new Error('Historical vector package changed');
console.log('Verified frozen vector-v1 package. Build current natural artwork with scripts/build/natural-library-bundle.mjs.');
