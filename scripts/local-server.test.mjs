import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, rename, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { createLocalServer, APP_ID, RELEASE_BRANCH } from './local-server.mjs';

test('fixed local link updates from cloud archives, retains history, and works offline', async t => {
  const temp=await mkdtemp(resolve(tmpdir(),'solar-server-test-')),remote=resolve(temp,'remote');
  await mkdir(remote);const git=args=>execFileSync('git',args,{cwd:remote,stdio:'ignore'});
  git(['init']);git(['checkout','-b',RELEASE_BRANCH]);git(['config','user.name','test']);git(['config','user.email','test@example.com']);
  const versions=[];
  async function publish(id) {
    const folder=resolve(remote,'releases',id);await mkdir(folder,{recursive:true});
    await writeFile(resolve(folder,'astronomy.html'),`<title>${id}</title>`);
    await writeFile(resolve(folder,'app.js'),'export const ready = true;');
    versions.push({id});await writeFile(resolve(remote,'manifest.json'),JSON.stringify({latest:id,versions}));
    await writeFile(resolve(remote,'versions.html'),versions.map(v=>v.id).join('\n'));
    git(['add','.']);git(['commit','-m',id]);
  }
  const first='v-111111111111',second='v-222222222222';await publish(first);
  const {server}=await createLocalServer({remote,cacheDir:resolve(temp,'cache'),updateIntervalMs:0,gitTimeoutMs:5000});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));await rm(temp,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  let response=await fetch(base,{redirect:'manual'});assert.equal(response.headers.get('location'),`/releases/${first}/astronomy.html`);
  assert.equal((await (await fetch(`${base}/api/status`)).json()).app,APP_ID);
  await publish(second);
  response=await fetch(base,{redirect:'manual'});assert.equal(response.headers.get('location'),`/releases/${second}/astronomy.html`);
  assert.ok((await (await fetch(`${base}/releases/${first}/astronomy.html`)).text()).includes(first));
  const history=await (await fetch(`${base}/versions.html`)).text();assert.ok(history.includes(first)&&history.includes(second));
  response=await fetch(`${base}/releases/${second}/app.js`);assert.ok(response.headers.get('content-type').startsWith('text/javascript'));
  assert.equal((await fetch(`${base}/.git/config`)).status,404);
  assert.equal((await fetch(base,{method:'POST'})).status,405);
  await rename(remote,remote+'-offline');
  response=await fetch(base,{redirect:'manual'});assert.equal(response.headers.get('location'),`/releases/${second}/astronomy.html`);
  assert.equal((await (await fetch(`${base}/api/status`)).json()).offline,true);
});
