import fs from 'node:fs';
import path from 'node:path';
import net from 'node:net';
import { spawn, execFileSync } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { demoProfile } from './web-demo-config.mjs';
import { localCertificate } from './certificate-local.mjs';

// Direct local HTTPS. No tunnel, external proxy or public URL is created.
const root=fileURLToPath(new URL('../../',import.meta.url));
const {values}=parseArgs({options:{port:{type:'string',default:'4110'},profile:{type:'string'},'public-base-url':{type:'string'},cert:{type:'string'},key:{type:'string'}}});
const port=Number(values.port);
if(!Number.isSafeInteger(port)||port<1024||port>65535)throw new Error('Cổng demo không hợp lệ.');
if(Boolean(values.cert)!==Boolean(values.key))throw new Error('Cần cả --cert và --key.');
const profile=demoProfile(root,port,values.profile);
const certificate=values.cert?{certFile:path.resolve(values.cert),keyFile:path.resolve(values.key)}:localCertificate(path.join(root,'local','certificates'));
const probe=net.createServer();
const free=await new Promise(resolve=>{probe.once('error',()=>resolve(false));probe.listen(port,'127.0.0.1',()=>probe.close(()=>resolve(true)));});
if(!free) {
  const pidFile=path.join(profile,'runtime.pid');
  if(process.platform!=='win32'||!fs.existsSync(pidFile))throw new Error(`Cổng ${port} đang dùng. Dừng demo trên cổng này trước.`);
  const pid=Number(fs.readFileSync(pidFile,'utf8').trim());
  const owner=Number(execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`(Get-NetTCPConnection -State Listen -LocalAddress 127.0.0.1 -LocalPort ${port}).OwningProcess`],{encoding:'utf8',windowsHide:true}).trim());
  if(!Number.isSafeInteger(pid)||pid<=0||pid!==owner)throw new Error('Không xác minh được tiến trình demo; giữ nguyên tiến trình hiện tại.');
  const launcherFile=path.join(profile,'launcher.pid');
  if(fs.existsSync(launcherFile)) {
    const launcherPid=Number(fs.readFileSync(launcherFile,'utf8').trim());
    if(!Number.isSafeInteger(launcherPid)||launcherPid<=0)throw new Error('PID launcher không hợp lệ.');
    const command=execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',`(Get-CimInstance Win32_Process -Filter "ProcessId = ${launcherPid}").CommandLine`],{encoding:'utf8',windowsHide:true});
    if(!/web-demo\.mjs/.test(command))throw new Error('Launcher không khớp bản demo.');
    process.kill(launcherPid);
  }
  process.kill(pid);
}
if(!fs.existsSync(path.join(profile,'trang-thai-demo.json'))) {
  const prepared=spawn(process.execPath,[path.join(root,'scripts/dev/web-demo.mjs'),'--port',String(port),'--profile',profile,'--prepare'],{cwd:root,windowsHide:true,stdio:'inherit'});
  const [code]=await once(prepared,'exit');if(code!==0)throw new Error('Chưa khởi tạo được profile demo.');
}
const app=spawn(process.execPath,[path.join(root,'scripts/dev/web-demo.mjs'),'--port',String(port),'--profile',profile,
  '--https-cert',certificate.certFile,'--https-key',certificate.keyFile,
  ...(values['public-base-url']?['--public-base-url',values['public-base-url']]:[])],{cwd:root,windowsHide:true,stdio:['inherit','inherit','inherit','ipc']});
const stop=()=>{if(app.connected)app.send('demo-stop',()=>{});};
process.once('SIGINT',stop);process.once('SIGTERM',stop);
process.on('message',message=>{if(message==='demo-stop')stop();});
console.log(`HTTPS trực tiếp tại https://127.0.0.1:${port}. ${values.cert ? 'Dùng cặp chứng chỉ được chỉ định.' : 'Chứng chỉ localhost tự ký có thể hiện cảnh báo tin cậy; không mở ra Internet.'}`);
const [code]=await once(app,'exit');
process.exitCode=code || 0;
