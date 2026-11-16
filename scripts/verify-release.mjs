import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';

const root=fs.realpathSync(path.resolve(process.argv[2] || 'dist/release'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'release-manifest.json'),'utf8'));
const expected=new Set(['release-manifest.json']);
const forbidden=relative=>relative.split('/').some(part=>part==='data'||part==='node_modules'
  || part==='.env'||(part.startsWith('.env.')&&part!=='.env.example')||/\.(log|tmp)$/.test(part));
for(const entry of manifest.files) {
  if(typeof entry.path!=='string'||entry.path.includes('\\')||forbidden(entry.path)) throw new Error('Forbidden manifest path');
  const filename=path.resolve(root,entry.path);
  if(!filename.startsWith(root+path.sep)||path.relative(root,filename).split(path.sep).join('/')!==entry.path
    ||fs.realpathSync(filename)!==filename||expected.has(entry.path)) throw new Error('Unsafe or duplicate manifest path');
  expected.add(entry.path);
  const actual=createHash('sha256').update(fs.readFileSync(filename)).digest('hex');
  if(actual!==entry.sha256) throw new Error(`Checksum mismatch: ${entry.path}`);
}
function inspect(directory) {
  for(const entry of fs.readdirSync(directory,{withFileTypes:true})) {
    // Installed dependencies are not source files and must be excluded from the archive.
    if(entry.name==='node_modules') continue;
    const filename=path.join(directory,entry.name);
    if(entry.isSymbolicLink()) throw new Error('Release contains a symlink');
    if(entry.isDirectory()) inspect(filename);
    else {
      const relative=path.relative(root,filename).split(path.sep).join('/');
      if(forbidden(relative)||!expected.has(relative)) throw new Error(`Unexpected release file: ${relative}`);
    }
  }
}
inspect(root);
console.log(`PASS Release manifest: ${manifest.files.length} files, checksums and source exclusions.`);
