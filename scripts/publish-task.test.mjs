import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtemp,mkdir,writeFile,readFile,rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const publisher=fileURLToPath(new URL('./publish-task.mjs',import.meta.url));
test('generic publisher creates a discoverable archive and never overwrites an existing source snapshot',async t=>{
 const temp=await mkdtemp('/tmp/codex-publisher-test-');t.after(()=>rm(temp,{recursive:true,force:true}));const source=temp+'/source',remote=temp+'/remote.git',inspect=temp+'/inspect';await mkdir(source);
 const git=(cwd,...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim();
 git(temp,'init','--bare',remote);git(source,'init');git(source,'config','user.name','test');git(source,'config','user.email','test@example.com');git(source,'remote','add','origin',remote);await writeFile(source+'/.gitignore','dist/\n');await writeFile(source+'/README.md','first');git(source,'add','.');git(source,'commit','-m','first');await mkdir(source+'/dist');await writeFile(source+'/dist/index.html','first build');
 const publish=()=>execFileSync(process.execPath,[publisher,'--repo',source],{stdio:'ignore'});
 publish();git(temp,'clone','--branch','codex-releases',remote,inspect);let manifest=JSON.parse(await readFile(inspect+'/manifest.json'));const first=manifest.latest;assert.equal(manifest.entry,'index.html');assert.equal(await readFile(inspect+`/releases/${first}/index.html`,'utf8'),'first build');
 await writeFile(source+'/dist/index.html','must not replace');publish();git(inspect,'pull','--ff-only');assert.equal(await readFile(inspect+`/releases/${first}/index.html`,'utf8'),'first build');
 await writeFile(source+'/README.md','second');git(source,'add','.');git(source,'commit','-m','second');await writeFile(source+'/dist/index.html','second build');publish();git(inspect,'pull','--ff-only');manifest=JSON.parse(await readFile(inspect+'/manifest.json'));assert.equal(manifest.versions.length,2);assert.notEqual(manifest.latest,first);assert.equal(await readFile(inspect+`/releases/${first}/index.html`,'utf8'),'first build');
});
