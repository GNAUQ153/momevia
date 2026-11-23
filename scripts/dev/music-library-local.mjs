// Isolated local review data; never loads .env, business DB or an existing demo.
import fs from 'node:fs';
import path from 'node:path';
import { startSfxFixture } from '../../tests/integration/sfx-fixture.mjs';
import { seedSfxDemoCard } from './sfx-demo-card.mjs';
const fixture=await startSfxFixture({port:Number(process.env.MUSIC_DEMO_PORT||0),label:'music-demo'});
const admin=await fixture.register('Music Library Admin'),sender=await fixture.register('Music Library Sender');
await fixture.app.modules.identity.service.users.update(admin.user.id,{role:'admin'});
const card=await seedSfxDemoCard(fixture,sender);
const links={base:fixture.base,library:fixture.base+'/admin/music-library',login:fixture.base+'/login',studio:fixture.base+'/design/'+card.designId,recipient:fixture.base+'/g/'+card.gift.slug};
const privateFile=path.join(fixture.directory,'demo-private.json');
fs.writeFileSync(privateFile,JSON.stringify({links,admin,sender},null,2));
fs.writeFileSync(path.join(fixture.directory,'demo-links.json'),JSON.stringify(links,null,2));
console.log(`MUSIC_LIBRARY=${links.library}\nSTUDIO=${links.studio}\nRECIPIENT=${links.recipient}\nLOCAL_DEMO_ACCOUNTS=${privateFile}`);
for(const event of ['SIGINT','SIGTERM'])process.once(event,async()=>{await fixture.close();process.exit(0);});
