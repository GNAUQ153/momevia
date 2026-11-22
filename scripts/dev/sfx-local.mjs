// Copies code into a new isolated fixture; never reads the repository .env/data.
import fs from 'node:fs';
import path from 'node:path';
import { startSfxFixture } from '../../tests/integration/sfx-fixture.mjs';
import { seedSfxDemoCard } from './sfx-demo-card.mjs';
const fixture=await startSfxFixture({port:Number(process.env.SFX_DEMO_PORT||4122),label:'demo'});
const owner=await fixture.register('Momevia SFX Demo');
const card=await seedSfxDemoCard(fixture,owner),silent=await seedSfxDemoCard(fixture,owner,{withSound:false});
fs.writeFileSync(path.join(fixture.directory,'three-signals.wav'),card.source);
fs.writeFileSync(path.join(fixture.directory,'session-private.json'),JSON.stringify({base:fixture.base,...owner,designId:card.designId,gift:card.gift,silentGift:silent.gift},null,2));
fs.writeFileSync(path.join(fixture.directory,'demo-links.json'),JSON.stringify({base:fixture.base,studio:`${fixture.base}/design/${card.designId}`,recipient:`${fixture.base}/g/${card.gift.slug}`,silent:`${fixture.base}/g/${silent.gift.slug}`},null,2));
console.log(`SFX_DEMO=${fixture.base}\nRECIPIENT=${fixture.base}/g/${card.gift.slug}\nPRIVATE_SESSION=${path.join(fixture.directory,'session-private.json')}`);
for(const event of ['SIGINT','SIGTERM'])process.once(event,async()=>{await fixture.close();process.exit(0);});
