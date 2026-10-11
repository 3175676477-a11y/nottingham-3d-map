import http from 'node:http';
import { validateManifest } from './task-contract.mjs';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, rename, rm, stat, realpath } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { homedir } from 'node:os';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const execute = promisify(execFile);
export const APP_ID = 'solar-atlas-local';
export const RELEASE_BRANCH = 'solar-atlas-releases';
export const DEFAULT_PORT = 43173;
export const REMOTE = 'https://github.com/3175676477-a11y/nottingham-3d-map.git';
export const APP_DIRECTORY = resolve(homedir(), 'Library/Application Support/SolarAtlas');
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.wasm':'application/wasm','.mjs':'text/javascript; charset=utf-8','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif','.ico':'image/x-icon','.woff2':'font/woff2','.woff':'font/woff','.ttf':'font/ttf','.mp4':'video/mp4','.webm':'video/webm','.glb':'model/gltf-binary','.gltf':'model/gltf+json'};
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');

export async function createLocalServer({cacheDir = resolve(APP_DIRECTORY, 'releases'), remote = REMOTE, updateIntervalMs = 15000, gitTimeoutMs = 20000, releaseBranch = RELEASE_BRANCH, entry = 'astronomy.html', mountPath = '', mountAliases = [], generateHistory = false} = {}) {
  let refreshing, lastAttempt = 0, offline = false;
  const git = args => execute('git', args, {timeout:gitTimeoutMs, maxBuffer:2*1024*1024, env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
  async function safeFile(filename) {
    const [root,file]=await Promise.all([realpath(cacheDir),realpath(filename)]);
    if(!file.startsWith(root+sep)||file.slice(root.length+1).split(sep).some(part=>part.startsWith('.')))throw Object.assign(new Error('File escapes release cache'),{code:'EACCES'});
    return file;
  }
  async function manifest() {
    const data = JSON.parse(await readFile(await safeFile(resolve(cacheDir,'manifest.json')),'utf8'));
    return validateManifest(data);
  }
  async function refresh(force = false) {
    if (refreshing) return refreshing;
    if (!force && Date.now() - lastAttempt < updateIntervalMs) return;
    refreshing = (async () => {
      try {
        let exists = true;
        try { await access(resolve(cacheDir,'.git')); } catch { exists = false; }
        if (exists) {
          await git(['-C',cacheDir,'pull','--ff-only','origin',releaseBranch]);
        } else {
          await mkdir(dirname(cacheDir),{recursive:true});
          const staging = `${cacheDir}.download-${process.pid}`;
          await rm(staging,{recursive:true,force:true});
          try {
            await git(['clone','--single-branch','--branch',releaseBranch,remote,staging]);
            await rename(staging,cacheDir);
          } finally { await rm(staging,{recursive:true,force:true}); }
        }
        await manifest(); offline = false;
      } catch {
        offline = true;
      } finally { lastAttempt = Date.now(); }
    })();
    try { await refreshing; } finally { refreshing = null; }
  }
  const json = (response, data, status = 200) => {
    response.writeHead(status,{'Content-Type':types['.json'],'Cache-Control':'no-store'});
    response.end(JSON.stringify(data));
  };
  const server = http.createServer(async (request, response) => {
    let requestMount = mountPath;
    try {
      const host = new URL(`http://${request.headers.host || 'invalid'}`).hostname;
      if (!['127.0.0.1','localhost'].includes(host)) { response.writeHead(403); response.end(); return; }
      if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      let pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      requestMount = mountAliases.find(prefix=>pathname.startsWith(prefix + '/')) || mountPath;
      if (requestMount) { if (!pathname.startsWith(requestMount + '/')) { response.writeHead(404);response.end();return; } pathname = pathname.slice(requestMount.length); }
      if (pathname === '/api/status') {
        let data; try { data = await manifest(); } catch {}
        json(response,{app:APP_ID,latest:data?.latest,offline,lastChecked:lastAttempt}); return;
      }
      if (pathname === '/' || pathname === '/index.html') {
        await refresh();
        const data = await manifest();
        const page = data.versions.find(v=>v.id===data.latest)?.entry || data.entry || entry;
        response.writeHead(302,{'Location':`${requestMount}/releases/${data.latest}/${page}`,'Cache-Control':'no-store'}); response.end(); return;
      }
      if (pathname === '/versions.html' || pathname === '/manifest.json') await refresh();
      if (pathname === '/versions.html' && generateHistory) {
        const data = await manifest();
        const rows = [...data.versions].reverse().map(v=>`<li><a href="./releases/${v.id}/${v.entry || data.entry || entry}">${escape(v.label || v.id)}</a> <small>${escape(v.date || '')} · ${v.id}</small></li>`).join('');
        response.writeHead(200,{'Content-Type':types['.html'],'Cache-Control':'no-store'});
        response.end(`<!doctype html><meta charset="utf-8"><title>任务历史版本</title><style>body{font:16px/2 system-ui;max-width:900px;margin:60px auto;padding:24px}li{margin:20px 0}small{color:#667}</style><h1>历史版本</h1><p><a href="./">打开最新版</a></p><ul>${rows}</ul>`);return;
      }
      if (!['/versions.html','/manifest.json'].includes(pathname) && !/^\/releases\/v-[0-9a-f]{12}\//.test(pathname)) {
        response.writeHead(404); response.end('Not found'); return;
      }
      const filename = resolve(cacheDir, '.' + pathname);
      if (!filename.startsWith(resolve(cacheDir) + sep) || pathname.split('/').some(part=>part.startsWith('.'))) {
        response.writeHead(403); response.end(); return;
      }
      const safeFilename = await safeFile(filename);
      const info = await stat(safeFilename);
      if (!info.isFile()) { response.writeHead(404); response.end(); return; }
      response.writeHead(200,{'Content-Type':types[extname(filename)] || 'application/octet-stream','Content-Length':info.size,'Cache-Control':pathname.startsWith('/releases/')?'public, max-age=31536000, immutable':'no-store','X-Content-Type-Options':'nosniff'});
      if (request.method === 'HEAD') response.end(); else createReadStream(safeFilename).pipe(response);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      const notFound = error.code === 'ENOENT' && request.url.includes('/releases/');
      response.writeHead(notFound?404:503,{'Content-Type':types['.html'],'Cache-Control':'no-store'});
      response.end(`<!doctype html><meta charset="utf-8"><title>日地月</title><h1>${notFound?'未找到此版本':'暂时无法打开日地月'}</h1><p>${escape(notFound?'请从历史版本目录选择已发布版本。':'第一次启动需要联网下载。请检查网络后重试；已经下载的版本仍保留在本机。')}</p><a href="${requestMount}/">重试最新版</a> · <a href="${requestMount}/versions.html">历史版本</a>`);
    }
  });
  async function verifyLatest() {
    const data=await manifest();const page=data.versions.find(v=>v.id===data.latest)?.entry||data.entry||entry;
    const file=await safeFile(resolve(cacheDir,'releases',data.latest,page));
    if(!(await stat(file)).isFile())throw new Error('Missing entry page');
    return data;
  }
  return {server,refresh,manifest,verifyLatest,status:()=>({offline,lastChecked:lastAttempt})};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const {server} = await createLocalServer();
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  server.listen(DEFAULT_PORT,'127.0.0.1',()=>console.log(`Solar Atlas: http://127.0.0.1:${DEFAULT_PORT}/`));
}
