import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {brotliCompressSync,constants} from 'node:zlib';

const root=fileURLToPath(new URL('../../',import.meta.url));
// Source HTML remains readable for development. The server selects this built
// shell only after a complete build; all chunks keep content-addressed names.
export async function buildClientBundles(){
 const outdir=path.join(root,'web/assets/app'),source=fs.readFileSync(path.join(root,'web/index.html'),'utf8');
 fs.mkdirSync(outdir,{recursive:true});
 const common={absWorkingDir:root,outdir,bundle:true,minify:true,target:'es2022',metafile:true,legalComments:'eof',logLevel:'warning'};
 const js=await build({...common,entryPoints:{app:'web/js/app.js'},format:'esm',splitting:true,external:['/assets/*'],entryNames:'[name]-[hash]',chunkNames:'chunks/[name]-[hash]',plugins:[{name:'fabric-on-demand',setup(api){api.onResolve({filter:/vendor\/(?:fabric|recipient-xlsx)\.mjs$/},args=>({path:args.path.includes('recipient-xlsx')?'/js/vendor/recipient-xlsx.mjs':'/js/vendor/fabric.mjs',external:true}));}}]});
 const boot=await build({...common,entryPoints:{'catalog-preload':'web/js/catalog-bootstrap.js'},format:'iife',entryNames:'[name]-[hash]'});
 const sheets=[...source.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*href="(\/css\/[^"?]+)[^"]*"[^>]*>/g)].map(m=>m[1]);
 const css=await build({...common,stdin:{contents:sheets.map(file=>`@import ${JSON.stringify('.'+file)};`).join('\n'),resolveDir:path.join(root,'web'),loader:'css'},entryNames:'styles-[hash]',assetNames:'[name]-[hash]',external:['/assets/*','https://*','data:*']});
 const catalogSheets=new Set(['app-fonts','tokens','base','layout','components','artwork','responsive','upgrade','catalog-filters','pagination','template-library','ui-polish','seasonal-catalog','preferences','brand-system','header-compact'].map(name=>`/css/${name}.css`));
 const catalogCss=await build({...common,stdin:{contents:sheets.filter(file=>catalogSheets.has(file)).map(file=>`@import ${JSON.stringify('.'+file)};`).join('\n'),resolveDir:path.join(root,'web'),loader:'css'},entryNames:'catalog-[hash]',assetNames:'[name]-[hash]',external:['/assets/*','https://*','data:*']});
 const url=file=>'/'+path.relative(path.join(root,'web'),path.resolve(root,file)).split(path.sep).join('/');
 const entry=Object.entries(js.metafile.outputs).find(([,v])=>v.entryPoint==='web/js/app.js')[0];
 const bootstrap=Object.keys(boot.metafile.outputs)[0];
 const style=Object.keys(css.metafile.outputs).find(file=>file.endsWith('.css'));
 const catalogStyle=Object.keys(catalogCss.metafile.outputs).find(file=>file.endsWith('.css'));
 const preloads=new Set();
 function visit(file){for(const item of js.metafile.outputs[file]?.imports||[])if(item.kind==='import-statement'&&!item.external&&!preloads.has(item.path)){preloads.add(item.path);visit(item.path);}}
 visit(entry);
 let inserted=false;
 let html=source.replace(/<link\b[^>]*rel="stylesheet"[^>]*href="\/css\/[^">]+"[^>]*>/g,()=>{if(inserted)return '';inserted=true;return `<link id="app-fonts" rel="stylesheet" href="${url(style)}" data-catalog-css="${url(catalogStyle)}" data-full-css="${url(style)}" />`;});
 html=html.replace('src="/js/app.js"',`src="${url(entry)}"`).replace('<script type="module" async src="/js/catalog-bootstrap.js"></script>',`<script async src="${url(bootstrap)}"></script>`).replace('</head>',[...preloads].map(file=>`<link rel="modulepreload" href="${url(file)}" />`).join('\n')+'\n</head>');
 fs.writeFileSync(path.join(outdir,'metafile.json'),JSON.stringify({...js.metafile,outputs:{...js.metafile.outputs,...boot.metafile.outputs}},null,2)+'\n');
 for(const file of [...Object.keys(js.metafile.outputs),...Object.keys(boot.metafile.outputs),...Object.keys(css.metafile.outputs),...Object.keys(catalogCss.metafile.outputs)].filter(f=>/\.(js|css)$/.test(f)))fs.writeFileSync(path.resolve(root,file)+'.br',brotliCompressSync(fs.readFileSync(path.resolve(root,file)),{params:{[constants.BROTLI_PARAM_QUALITY]:11}}));
 const qrLicense=['LICENSE','LICENSE.txt','LICENSE.md'].map(file=>path.join(root,'node_modules/qrcode-generator',file)).find(file=>fs.existsSync(file));
 if(qrLicense)fs.copyFileSync(qrLicense,path.join(outdir,'QRCODE_LICENSE.txt'));
 else fs.writeFileSync(path.join(outdir,'QRCODE_NOTICE.txt'),fs.readFileSync(path.join(root,'node_modules/qrcode-generator/dist/qrcode.mjs'),'utf8').split(/\r?\n/).slice(0,17).join('\n')+'\n');
 fs.writeFileSync(path.join(outdir,'index.next.html'),html);
 fs.renameSync(path.join(outdir,'index.next.html'),path.join(outdir,'index.html'));
 console.log(`Built browser ESM chunks and ${sheets.length} stylesheets in one ordered CSS bundle.`);
}
