import http from 'node:http';
import { createReadStream } from 'node:fs';
import { access, mkdir, readFile, rename, rm, stat } from 'node:fs/promises';
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
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml','.wasm':'application/wasm'};
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const validId = id => /^v-[0-9a-f]{12}$/.test(id || '');

export async function createLocalServer({cacheDir = resolve(APP_DIRECTORY, 'releases'), remote = REMOTE, updateIntervalMs = 15000, gitTimeoutMs = 20000} = {}) {
  let refreshing, lastAttempt = 0, offline = false;
  const git = args => execute('git', args, {timeout:gitTimeoutMs, maxBuffer:2*1024*1024, env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
  async function manifest() {
    const data = JSON.parse(await readFile(resolve(cacheDir,'manifest.json'),'utf8'));
    if (!validId(data.latest) || !Array.isArray(data.versions)) throw new Error('Invalid release catalogue');
    return data;
  }
  async function refresh() {
    if (refreshing) return refreshing;
    if (Date.now() - lastAttempt < updateIntervalMs) return;
    refreshing = (async () => {
      try {
        let exists = true;
        try { await access(resolve(cacheDir,'.git')); } catch { exists = false; }
        if (exists) {
          await git(['-C',cacheDir,'pull','--ff-only','origin',RELEASE_BRANCH]);
        } else {
          await mkdir(dirname(cacheDir),{recursive:true});
          const staging = `${cacheDir}.download-${process.pid}`;
          await rm(staging,{recursive:true,force:true});
          try {
            await git(['clone','--single-branch','--branch',RELEASE_BRANCH,remote,staging]);
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
    try {
      const host = new URL(`http://${request.headers.host || 'invalid'}`).hostname;
      if (!['127.0.0.1','localhost'].includes(host)) { response.writeHead(403); response.end(); return; }
      if (!['GET','HEAD'].includes(request.method)) { response.writeHead(405); response.end(); return; }
      const pathname = decodeURIComponent(new URL(request.url,'http://localhost').pathname);
      if (pathname === '/api/status') {
        let data; try { data = await manifest(); } catch {}
        json(response,{app:APP_ID,latest:data?.latest,offline,lastChecked:lastAttempt}); return;
      }
      if (pathname === '/' || pathname === '/index.html') {
        await refresh();
        const data = await manifest();
        response.writeHead(302,{'Location':`/releases/${data.latest}/astronomy.html`,'Cache-Control':'no-store'}); response.end(); return;
      }
      if (pathname === '/versions.html' || pathname === '/manifest.json') await refresh();
      if (!['/versions.html','/manifest.json'].includes(pathname) && !/^\/releases\/v-[0-9a-f]{12}\//.test(pathname)) {
        response.writeHead(404); response.end('Not found'); return;
      }
      const filename = resolve(cacheDir, '.' + pathname);
      if (!filename.startsWith(resolve(cacheDir) + sep) || pathname.split('/').some(part=>part.startsWith('.'))) {
        response.writeHead(403); response.end(); return;
      }
      const info = await stat(filename);
      if (!info.isFile()) { response.writeHead(404); response.end(); return; }
      response.writeHead(200,{'Content-Type':types[extname(filename)] || 'application/octet-stream','Content-Length':info.size,'Cache-Control':pathname.startsWith('/releases/')?'public, max-age=31536000, immutable':'no-store','X-Content-Type-Options':'nosniff'});
      if (request.method === 'HEAD') response.end(); else createReadStream(filename).pipe(response);
    } catch (error) {
      if (response.headersSent) { response.destroy(); return; }
      const notFound = error.code === 'ENOENT' && request.url.startsWith('/releases/');
      response.writeHead(notFound?404:503,{'Content-Type':types['.html'],'Cache-Control':'no-store'});
      response.end(`<!doctype html><meta charset="utf-8"><title>日地月</title><h1>${notFound?'未找到此版本':'暂时无法打开日地月'}</h1><p>${escape(notFound?'请从历史版本目录选择已发布版本。':'第一次启动需要联网下载。请检查网络后重试；已经下载的版本仍保留在本机。')}</p><a href="/">重试最新版</a> · <a href="/versions.html">历史版本</a>`);
    }
  });
  return {server,refresh};
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const {server} = await createLocalServer();
  server.on('error',error=>{console.error(error.message);process.exitCode=1;});
  server.listen(DEFAULT_PORT,'127.0.0.1',()=>console.log(`Solar Atlas: http://127.0.0.1:${DEFAULT_PORT}/`));
}
