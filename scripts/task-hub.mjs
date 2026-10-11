import http from 'node:http';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLocalServer, APP_DIRECTORY, APP_ID, DEFAULT_PORT, REMOTE, RELEASE_BRANCH } from './local-server.mjs';
import { DEFAULT_OWNER, validName } from './task-contract.mjs';
import { discoverRepositories, publishedBranch } from './github-discovery.mjs';
import { installFinderShortcuts, REPOSITORY_FOLDER } from './finder-shortcuts.mjs';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export async function createTaskHub({stateDir=APP_DIRECTORY,home=homedir(),owner=DEFAULT_OWNER,port=DEFAULT_PORT,intervalMs=300000,listRepositories=()=>discoverRepositories(owner),primaryRemote=REMOTE,autoStart=true,gitTimeoutMs=20000}={}) {
 if(!validName(owner))throw new Error('GitHub 账号名称无效');
 const tasks=new Map(),status={owner,organizerVersion:1,folder:resolve(home,'Documents/codex'),syncing:false,lastSync:null,privateAccess:false,errors:[],waiting:[]};
 let flight,timer,closed=false;
 const prefix=name=>`/projects/${owner}/${name}`;
 async function register(task) {
  if(!validName(task.name)||!['codex-releases',RELEASE_BRANCH].includes(task.branch))throw new Error('任务配置无效');
  const key=task.name.toLowerCase();if(tasks.has(key))return tasks.get(key);
  const primary=key===REPOSITORY_FOLDER;
  const local=await createLocalServer({cacheDir:primary?resolve(stateDir,'releases'):resolve(stateDir,'tasks',key),remote:task.remote,releaseBranch:task.branch,entry:primary?'astronomy.html':'index.html',mountPath:primary?'':prefix(task.name),mountAliases:primary?[prefix(task.name)]:[],generateHistory:!primary,gitTimeoutMs});
  const entry={...task,local};tasks.set(key,entry);return entry;
 }
 await register({name:REPOSITORY_FOLDER,remote:primaryRemote,branch:RELEASE_BRANCH});
 try {
  const saved=JSON.parse(await readFile(resolve(stateDir,'tasks.json'),'utf8'));
  if(saved.owner===owner)for(const task of saved.repositories||[]){if(validName(task.name)&&task.branch==='codex-releases')await register({name:task.name,branch:task.branch,remote:`https://github.com/${owner}/${task.name}.git`});}
 }catch{}
 async function persist(){await mkdir(stateDir,{recursive:true});const file=resolve(stateDir,'tasks.json');await writeFile(file+'.next',JSON.stringify({owner,repositories:[...tasks.values()].map(({name,branch})=>({name,branch}))},null,2));await rename(file+'.next',file);}
 async function sync(){
  if(closed)return;
  if(flight)return flight;
  flight=(async()=>{
   status.syncing=true;status.errors=[];status.waiting=[];
   const candidates=new Map([...tasks].map(([key,task])=>[key,{name:task.name,remote:task.remote}]));
   try {const found=await listRepositories();status.privateAccess=!!found.privateAccess;for(const repo of found.repositories){if(validName(repo.name))candidates.set(repo.name.toLowerCase(),repo);}}
   catch{status.errors.push('无法发现新仓库；继续同步已登记的项目。检查网络或 GitHub 登录。');}
   const queue=[...candidates.values()];
   await Promise.all(Array.from({length:Math.min(3,queue.length)},async()=>{
    while(queue.length&&!closed){const repo=queue.shift();try{
     let task=tasks.get(repo.name.toLowerCase());
     if(!task){const branch=await publishedBranch(repo.remote);if(!branch){status.waiting.push(repo.name);continue;}task=await register({...repo,branch});}
     await task.local.refresh(true);const manifest=await task.local.verifyLatest();
     if(task.local.status().offline)status.errors.push(`${repo.name}：更新失败，使用本机已有版本。`);
     await installFinderShortcuts(home,task.name,`http://127.0.0.1:${port}${prefix(task.name)}`);
     task.latest=manifest.latest;
    }catch{status.errors.push(`${repo.name}：同步未完成，已有文件与历史版本保留。`);}}
   }));
   await persist();status.lastSync=new Date().toISOString();
  })().catch(()=>{status.errors.push('无法保存同步状态，请检查本机目录权限。');}).finally(()=>{status.syncing=false;flight=null;});
  return flight;
 }
 const server=http.createServer(async(request,response)=>{
  try{
   if(!['localhost','127.0.0.1'].includes(new URL(`http://${request.headers.host||'invalid'}`).hostname)){response.writeHead(403);response.end();return;}
   if(!['GET','HEAD'].includes(request.method)){response.writeHead(405);response.end();return;}
   const path=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
   if(path==='/api/status'||path==='/api/tasks'){
    let manifest;try{manifest=await tasks.get(REPOSITORY_FOLDER).local.manifest();}catch{}
    response.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});response.end(JSON.stringify({app:APP_ID,latest:manifest?.latest,...tasks.get(REPOSITORY_FOLDER).local.status(),...status,tasks:[...tasks.values()].map(({name,latest})=>({name,latest,url:prefix(name)+'/'}))}));return;
   }
   if(path==='/tasks.html'){
    response.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    response.end(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Codex 自动同步</title><style>body{font:16px/1.8 system-ui;max-width:850px;margin:50px auto;padding:24px}li{margin:20px 0}p{color:#567}</style><h1>文稿 / codex</h1><p>账号：${escape(owner)} · 每 5 分钟发现新仓库并同步已发布网页。${status.syncing?'正在同步…':'最近完成：'+escape(status.lastSync||'等待首次同步')}</p><p>${status.privateAccess?'已使用本机 GitHub CLI 授权发现仓库。':'当前按公开仓库发现；私有仓库需要本机 GitHub CLI 登录与 Git 读取权限。'}</p><ul>${[...tasks.values()].filter(t=>t.latest).map(t=>`<li>${escape(t.name)} · <a href="${prefix(t.name)}/">最新版本</a> · <a href="${prefix(t.name)}/versions.html">历史版本</a></li>`).join('')}</ul><p>${status.errors.map(escape).join('<br>')}</p><p>未发布网页的仓库：${status.waiting.map(escape).join('、')||'无'}</p><p>刷新此页查看状态。每个任务的源码与构建版本保留在其自己的 GitHub 仓库，本机只下载静态构建。</p>`);return;
   }
   if(path.startsWith('/projects/')){
    const match=path.match(/^\/projects\/([^/]+)\/([^/]+)(\/.*)?$/);const task=match&&match[1]===owner&&tasks.get(match[2].toLowerCase());
    if(!task){response.writeHead(404);response.end('项目尚未同步，请检查 /tasks.html');return;}
    if(!match[3]){response.writeHead(302,{Location:prefix(task.name)+'/'});response.end();return;}
    task.local.server.emit('request',request,response);return;
   }
   tasks.get(REPOSITORY_FOLDER).local.server.emit('request',request,response);
  }catch{response.writeHead(500);response.end('同步服务暂时不可用');}
 });
 if(autoStart){timer=setInterval(()=>void sync(),intervalMs);timer.unref();void sync();}
 async function close(){closed=true;clearInterval(timer);await flight;server.closeAllConnections();if(server.listening)await new Promise(r=>server.close(r));}
 return {server,sync,status,close};
}
if(process.argv[1]&&fileURLToPath(import.meta.url)===resolve(process.argv[1])){
 const hub=await createTaskHub();hub.server.on('error',e=>{console.error(e.message);process.exitCode=1;});hub.server.listen(DEFAULT_PORT,'127.0.0.1',()=>console.log('Codex Finder Sync ready'));
}
