import fs from 'node:fs';
import { parseArgs } from 'node:util';
import { MySqlClient } from '../../src/infrastructure/mysql/client.mjs';
import { CanvasLibraryService } from '../../src/modules/designs/library.service.mjs';

// Local DB credentials provide the authority for this operations CLI. It never
// exposes those credentials through HTTP or writes application design rows.
const { values } = parseArgs({ options: { export: { type: 'string' }, put: { type: 'string' } } });
const client = new MySqlClient(), service = new CanvasLibraryService(client);
try {
  await service.ready();
  if (values.put) {
    const { kind, id, ...input } = JSON.parse(fs.readFileSync(values.put, 'utf8'));
    await service.put({ role: 'admin' }, kind, id, input);
    console.log(`Saved ${kind}/${id}.`);
  }
  const snapshot = await service.refresh({ admin: true });
  if (values.export) fs.writeFileSync(values.export, JSON.stringify(snapshot, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log('Canvas library:', Object.fromEntries([...new Set(snapshot.items.map(r => r.kind))].map(kind => [kind, snapshot.items.filter(r => r.kind === kind).length])));
} finally { await client.close(); }
