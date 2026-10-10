import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { RELEASE_BRANCH } from './local-server.mjs';

const root = fileURLToPath(new URL('..',import.meta.url));
const args = process.argv.slice(2);
const option = name => { const i=args.indexOf(name);return i<0?undefined:args[i+1]; };
const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0' };
if (process.env.GITHUB_ACTIONS === 'true' && process.env.GITHUB_TOKEN) {
  gitEnv.GIT_CONFIG_COUNT = '1';
  gitEnv.GIT_CONFIG_KEY_0 = 'http.https://github.com/.extraheader';
  gitEnv.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${process.env.GITHUB_TOKEN}`).toString('base64')}`;
}
const git = (args,cwd=root) => execFileSync('git',args,{cwd,encoding:'utf8',env:gitEnv}).trim();
const escape = value => String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
const source = git(['rev-parse',option('--source') || 'HEAD']);
const id = `v-${source.slice(0,12)}`;
const remote = git(['remote','get-url','origin']);
const date = git(['show','-s','--format=%cI',source]);
const label = option('--label') || git(['show','-s','--format=%s',source]);
const distOverride = option('--dist');
if (!distOverride && git(['status','--porcelain'])) throw new Error('请先提交并验证源码，再发布版本。');
const temp = await mkdtemp(resolve(tmpdir(),'solar-atlas-publish-'));
try {
  const existing = git(['ls-remote','--heads','origin',RELEASE_BRANCH]);
  if (existing) {
    execFileSync('git',['clone','--single-branch','--branch',RELEASE_BRANCH,remote,temp],{stdio:'inherit',env:gitEnv});
  } else {
    git(['init'],temp);git(['checkout','--orphan',RELEASE_BRANCH],temp);git(['remote','add','origin',remote],temp);
  }
  let manifest = {schema:1,latest:null,versions:[]};
  try { manifest=JSON.parse(await readFile(resolve(temp,'manifest.json'),'utf8')); } catch {}
  if (manifest.versions.some(version=>version.id===id)) {
    console.log(`版本 ${id} 已归档，未覆盖。`);process.exitCode=0;
  } else {
    let dist;
    if (distOverride) dist=resolve(distOverride);
    else {
      execFileSync('npm',['run','build'],{cwd:root,stdio:'inherit',env:{...process.env,VITE_RELEASE_ID:id}});
      dist=resolve(root,'dist');
    }
    const destination=resolve(temp,'releases',id);
    await mkdir(destination,{recursive:true});await cp(dist,destination,{recursive:true});
    const entry={id,sourceCommit:source,date,label,builtAt:new Date().toISOString()};
    if(option('--notes'))entry.notes=option('--notes');
    manifest.versions.push(entry);
    manifest.versions.sort((a,b)=>Date.parse(b.date)-Date.parse(a.date));
    manifest.latest=manifest.versions[0].id;
    await writeFile(resolve(temp,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
    await writeFile(resolve(temp,'.nojekyll'),'');
    const rows=manifest.versions.map(version=>`<article><div><b>${escape(version.label)}</b><p>${escape(version.date)} · ${escape(version.id)} ${version.id===manifest.latest?'· 最新版':''}</p></div><a href="./releases/${version.id}/astronomy.html">打开此版本</a><a href="https://github.com/3175676477-a11y/nottingham-3d-map/commit/${version.sourceCommit}">源码记录</a></article>`).join('\n');
    await writeFile(resolve(temp,'versions.html'),`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>日地月 · 历史版本</title><style>body{font:16px/1.6 system-ui;background:#0b1220;color:#e4eaf2;max-width:960px;margin:60px auto;padding:24px}a{color:#ffd68b}article{padding:24px;border:1px solid #344155;border-radius:12px;margin:18px 0}article>a{margin-right:24px}p{color:#a5b4c8}h1{font-size:32px}</style><h1>日地月 · 历史版本</h1><p>每个版本独立保存。打开旧版不会覆盖最新版；桌面的“打开日地月”始终检查最新版。</p><p><a href="./">打开最新版</a></p>${rows}</html>\n`);
    await writeFile(resolve(temp,'index.html'),`<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=./releases/${manifest.latest}/astronomy.html"><title>打开日地月</title><a href="./releases/${manifest.latest}/astronomy.html">打开最新版</a> · <a href="./versions.html">历史版本</a>\n`);
    await writeFile(resolve(temp,'README.md'),'# Solar Atlas releases\n\nImmutable built snapshots. The manifest selects the newest published source commit. Older release directories must never be overwritten or removed. Source code and local installer are on codex/sherwood-hall-map.\n');
    git(['config','user.name','Solar Atlas publisher'],temp);git(['config','user.email','solar-atlas@users.noreply.github.com'],temp);
    git(['add','.'],temp);git(['commit','-m',`Archive ${id}: ${label}`],temp);
    // A non-fast-forward push fails rather than overwriting another publisher.
    execFileSync('git',['push','origin',`HEAD:${RELEASE_BRANCH}`],{cwd:temp,stdio:'inherit',env:gitEnv});
    console.log(`已归档 ${id}；最新版：${manifest.latest}`);
  }
} finally { await rm(temp,{recursive:true,force:true}); }
