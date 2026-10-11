import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp,mkdir,writeFile,readFile,readdir,rename,rm,symlink } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createTaskHub } from './task-hub.mjs';
import { discoverRepositories } from './github-discovery.mjs';

test('discovers newly published repositories, creates Documents/codex entries, updates independently and preserves offline history',async t=>{
 const temp=await mkdtemp('/tmp/codex-hub-'),home=temp+'/home',stateDir=temp+'/state';
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,stdio:'ignore'});
 async function repo(name,branch){const root=temp+'/'+name;await mkdir(root);git(root,'init');git(root,'checkout','-b',branch);git(root,'config','user.name','test');git(root,'config','user.email','test@example.com');return root;}
 async function publish(root,id,entry='index.html'){
  const folder=root+'/releases/'+id;await mkdir(folder,{recursive:true});await writeFile(folder+'/'+entry,`<title>${id}</title><a href="./asset.js">asset</a>`);await writeFile(folder+'/asset.js','// '+id);
  let versions=[];try{versions=JSON.parse(await readFile(root+'/manifest.json')).versions;}catch{}
  versions.push({id,entry});await writeFile(root+'/manifest.json',JSON.stringify({latest:id,entry,versions}));await writeFile(root+'/versions.html',versions.map(v=>v.id).join('\n'));git(root,'add','.');git(root,'commit','-m',id);
 }
 const primary=await repo('primary','solar-atlas-releases'),alpha=await repo('alpha','codex-releases'),beta=await repo('beta','main');
 const v1='v-111111111111',v2='v-222222222222';await publish(primary,v1,'astronomy.html');await publish(alpha,v1);await writeFile(beta+'/README.md','pending');git(beta,'add','.');git(beta,'commit','-m','not yet published');
 await mkdir(home+'/Documents/codex/existing-task',{recursive:true});await writeFile(home+'/Documents/codex/existing-task/notes.txt','keep');
 const hub=await createTaskHub({stateDir,home,primaryRemote:primary,owner:'example',autoStart:false,gitTimeoutMs:5000,listRepositories:async()=>({repositories:[{name:'alpha',remote:alpha},{name:'beta',remote:beta}],privateAccess:false})});
 await new Promise(r=>hub.server.listen(0,'127.0.0.1',r));t.after(async()=>{await hub.close();await rm(temp,{recursive:true,force:true});});const base=`http://127.0.0.1:${hub.server.address().port}`;
 await hub.sync();const names=await readdir(home+'/Documents/codex');assert.ok(names.includes('alpha'));assert.ok(!names.includes('beta'));assert.ok(hub.status.waiting.includes('beta'));
 const links=await readdir(home+'/Documents/codex/alpha');assert.deepEqual(links.sort(),['历史版本.webloc','最新版本.webloc'].sort());assert.match(await readFile(home+'/Documents/codex/alpha/最新版本.webloc','utf8'),/\/projects\/example\/alpha\//);
 let response=await fetch(base+'/projects/example/alpha/',{redirect:'manual'});assert.equal(response.headers.get('location'),`/projects/example/alpha/releases/${v1}/index.html`);
 assert.equal((await fetch(base+'/api/status').then(r=>r.json())).organizerVersion,1);
 git(beta,'checkout','-b','codex-releases');await publish(beta,v1);await publish(alpha,v2);
 // A new process-style server refresh must not be prevented by the normal 15s access throttle.
 await new Promise(r=>setTimeout(r,10));
 const alphaTask=JSON.parse(await readFile(stateDir+'/tasks.json'));assert.ok(alphaTask.repositories.some(t=>t.name==='alpha'));
 // The hub's scheduled sync forces repository checks independently of page access throttling.
 await hub.sync();response=await fetch(base+'/projects/example/alpha/',{redirect:'manual'});assert.equal(response.headers.get('location'),`/projects/example/alpha/releases/${v2}/index.html`);
 assert.ok((await readdir(home+'/Documents/codex')).includes('beta'));assert.match(await fetch(base+`/projects/example/alpha/releases/${v1}/index.html`).then(r=>r.text()),new RegExp(v1));
 const history=await fetch(base+'/projects/example/alpha/versions.html').then(r=>r.text());assert.ok(history.includes(v1)&&history.includes(v2));assert.equal(await readFile(home+'/Documents/codex/existing-task/notes.txt','utf8'),'keep');
 const b=await fetch(base+'/projects/example/beta/',{redirect:'manual'});assert.ok(b.headers.get('location').includes(v1));
 await writeFile(temp+'/private.txt','secret');await symlink(temp+'/private.txt',alpha+`/releases/${v2}/outside.txt`);git(alpha,'add','.');git(alpha,'commit','-m','symlink fixture');await hub.sync();assert.notEqual((await fetch(base+`/projects/example/alpha/releases/${v2}/outside.txt`)).status,200);
 await rename(alpha,alpha+'-offline');await hub.sync();response=await fetch(base+'/projects/example/alpha/',{redirect:'manual'});assert.ok(response.headers.get('location').includes(v2));assert.ok(hub.status.errors.some(e=>e.includes('alpha')));
 assert.equal((await fetch(base+'/api/tasks',{method:'POST'})).status,405);
});

test('public repository discovery paginates and filters owner and unsafe names',async()=>{
 let requests=0;const owner='example';const batch=Array.from({length:100},(_,i)=>({name:'repo'+i,owner:{login:owner}}));
 const result=await discoverRepositories(owner,{run:async()=>{throw new Error('gh unavailable');},fetchImpl:async()=>({ok:true,json:async()=>++requests===1?batch:[{name:'last',owner:{login:owner}},{name:'../escape',owner:{login:owner}},{name:'someone',owner:{login:'other'}}]})});
 assert.equal(requests,2);assert.equal(result.repositories.length,101);assert.equal(result.privateAccess,false);assert.ok(result.repositories.every(r=>r.remote.startsWith('https://github.com/example/')));
});
test('authenticated discovery supports private repositories without putting credentials in remotes',async()=>{
 const result=await discoverRepositories('example',{run:async()=>({stdout:JSON.stringify([[{name:'private-app',owner:{login:'example'},private:true}]])}),fetchImpl:async()=>{throw new Error('public API must not be called');}});
 assert.equal(result.privateAccess,true);assert.equal(result.repositories[0].remote,'https://github.com/example/private-app.git');
});
