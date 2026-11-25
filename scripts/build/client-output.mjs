import fs from 'node:fs';
import path from 'node:path';

const fixedFiles=['index.html','metafile.json','QRCODE_LICENSE.txt','QRCODE_NOTICE.txt'];
function localOutput(value){
  const normalized=String(value).replaceAll('\\','/'),marker='assets/app/',at=normalized.indexOf(marker);
  if(at<0)return null;
  const relative=normalized.slice(at+marker.length);
  return relative&&!path.posix.isAbsolute(relative)&&!relative.split('/').includes('..')?relative:null;
}
export function clientOutputFiles(metadata,html=''){
  const files=new Set(fixedFiles);
  for(const name of Object.keys(metadata.outputs||{})){const relative=localOutput(name);if(relative)files.add(relative);}
  for(const match of html.matchAll(/\/assets\/app\/([^"<>\s]+)/g)){const relative=localOutput(match[0]);if(relative)files.add(relative);}
  for(const name of [...files])if(/\.(js|css)$/.test(name))files.add(name+'.br');
  return files;
}
function realDirectory(directory){
  const absolute=path.resolve(directory);
  if(fs.lstatSync(absolute).isSymbolicLink()||fs.realpathSync(absolute)!==absolute)throw new Error('Client output must be a real directory');
  return absolute;
}
export function readClientOutputFiles(directory){
  if(!fs.existsSync(directory))return null;
  realDirectory(directory);
  try{
    const metadata=JSON.parse(fs.readFileSync(path.join(directory,'metafile.json'),'utf8'));
    if(!metadata.outputs||typeof metadata.outputs!=='object'||Array.isArray(metadata.outputs))return null;
    if(!Object.keys(metadata.outputs).some(name=>localOutput(name)?.endsWith('.js')))return null;
    return clientOutputFiles(metadata,fs.readFileSync(path.join(directory,'index.html'),'utf8'));
  }catch{return null;}
}
export function pruneClientOutput(directory,current,previous){
  // A missing old manifest cannot prove which files an open client needs.
  if(!previous)return 0;
  const root=realDirectory(directory),keep=new Set([...current,...previous]);let removed=0;
  function visit(folder){
    for(const entry of fs.readdirSync(folder,{withFileTypes:true})){
      const file=path.join(folder,entry.name);
      if(fs.lstatSync(file).isSymbolicLink())continue;
      if(entry.isDirectory()){visit(file);continue;}
      const relative=path.relative(root,file).split(path.sep).join('/');
      if(keep.has(relative))continue;
      if(!fs.realpathSync(file).startsWith(root+path.sep))throw new Error('Client output escaped its directory');
      fs.unlinkSync(file);removed++;
    }
  }
  visit(root);return removed;
}
