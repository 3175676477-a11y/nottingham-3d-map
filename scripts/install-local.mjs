import { execFileSync } from 'node:child_process';
import { copyFile, mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { installFinderShortcuts } from './finder-shortcuts.mjs';
import { APP_DIRECTORY, APP_ID, DEFAULT_PORT } from './local-server.mjs';

if (process.platform !== 'darwin') {
  console.error('此安装程序用于 Mac。它会安装一个本地后台服务，并在“文稿/codex/仓库名称”及桌面创建网页链接。');
  process.exit(1);
}
const home = homedir(), label = 'com.solaratlas.local', domain = `gui/${process.getuid()}`;
const xml = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const runtimeDir = resolve(APP_DIRECTORY,'runtime'), logs = resolve(APP_DIRECTORY,'logs');
const agents = resolve(home,'Library/LaunchAgents'), desktop = resolve(home,'Desktop');
await Promise.all([runtimeDir,logs,agents,desktop].map(path=>mkdir(path,{recursive:true})));
let running;
try { running=await fetch(`http://127.0.0.1:${DEFAULT_PORT}/api/status`,{signal:AbortSignal.timeout(1500)}); }
catch(error) {
  if(error.cause?.code!=='ECONNREFUSED'){console.error(`无法确认端口 ${DEFAULT_PORT} 是否可用，安装已停止。`);process.exit(1);}
}
if(running) {
  let data;try { data=await running.json(); } catch {}
  if(data?.app!==APP_ID){console.error(`端口 ${DEFAULT_PORT} 已被其他程序占用。安装已停止。`);process.exit(1);}
}
const finderDirectory = await installFinderShortcuts(home);
const runtime = resolve(runtimeDir,'task-hub.mjs');
try { execFileSync('launchctl',['bootout',`${domain}/${label}`],{stdio:'ignore'}); } catch {}
for (const name of ['task-hub.mjs','local-server.mjs','task-contract.mjs','finder-shortcuts.mjs','github-discovery.mjs']) {
  await copyFile(fileURLToPath(new URL('./'+name,import.meta.url)),resolve(runtimeDir,name));
}
const plist = resolve(agents,`${label}.plist`);
await writeFile(plist,`<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>${label}</string>
<key>ProgramArguments</key><array><string>${xml(process.execPath)}</string><string>${xml(runtime)}</string></array>
<key>WorkingDirectory</key><string>${xml(APP_DIRECTORY)}</string>
<key>EnvironmentVariables</key><dict><key>PATH</key><string>/usr/bin:/bin:/usr/sbin:/sbin:/usr/local/bin:/opt/homebrew/bin</string></dict>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>${xml(resolve(logs,'server.log'))}</string>
<key>StandardErrorPath</key><string>${xml(resolve(logs,'error.log'))}</string>
</dict></plist>\n`);
for (const [name,path] of [['打开日地月','/'],['日地月历史版本','/versions.html']]) {
  await writeFile(resolve(desktop,`${name}.webloc`),`<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>URL</key><string>http://127.0.0.1:${DEFAULT_PORT}${path}</string></dict></plist>\n`);
}
try {
  execFileSync('launchctl',['bootstrap',domain,plist],{stdio:'inherit'});
  let ready=false;
  for(let attempt=0;attempt<30;attempt++) {
    try { const response=await fetch(`http://127.0.0.1:${DEFAULT_PORT}/api/status`,{signal:AbortSignal.timeout(500)});const status=await response.json();if(status.app===APP_ID&&status.organizerVersion===1){ready=true;break;} } catch {}
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  if(!ready)throw new Error(`后台服务未启动，请查看 ${resolve(logs,'error.log')}`);
  execFileSync('open',[`http://127.0.0.1:${DEFAULT_PORT}/tasks.html`]);
  execFileSync('open',[finderDirectory]);
  console.log(`安装完成。访达目录：${finderDirectory}`);
  console.log('后台每 5 分钟发现已发布的公开仓库，自动创建仓库文件夹和最新/历史入口。');
  console.log('现有文稿/codex 中其他文件保留，只更新本工具管理的两个网页快捷方式。');
  console.log('“日地月历史版本”可打开以前的版本。服务在登录 Mac 时自动运行，无需保留终端窗口。');
} catch(error) { console.error(error.message);process.exitCode=1; }
