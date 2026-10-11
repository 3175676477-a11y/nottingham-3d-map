// Portable static-web publisher for new repositories. No dependencies.
import { execFileSync } from 'node:child_process';
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { resolve, relative, sep } from 'node:path';
import { tmpdir } from 'node:os';
const args=process.argv.slice(2),option=(name,fallback)=>{const i=args.indexOf(name);return i<0?fallback:args[i+1];};
const root=resolve(option('--repo',process.cwd())),dist=resolve(root,option('--dist','dist')),entry=option('--entry','index.html'),branch='codex-releases';
if(!/^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.html$/.test(entry))throw new Error('Invalid entry page');
const within=relative(root,dist);if(!within||within.startsWith('..'+sep)||within==='..'||resolve(dist)===resolve(root,'.git'))throw new Error('Build folder must be a child of the repository');
if(!(await stat(resolve(dist,entry))).isFile())throw new Error('Build entry missing');
const env={...process.env,GIT_TERMINAL_PROMPT:'0'};
const git=(argv,cwd=root)=>execFileSync('git',argv,{cwd,encoding:'utf8',env}).trim();
if(git(['status','--porcelain']))throw new Error('Commit and verify the source before publishing');
const source=git(['rev-parse','HEAD']),id='v-'+source.slice(0,12),date=git(['show','-s','--format=%cI','HEAD']),label=git(['show','-s','--format=%s','HEAD']);
const remote=git(['remote','get-url','origin']),temp=await mkdtemp(resolve(tmpdir(),'codex-publish-'));
try{
 if(git(['ls-remote','--heads','origin',branch]))execFileSync('git',['clone','--single-branch','--branch',branch,remote,temp],{env,stdio:'inherit'});
 else {git(['init'],temp);git(['checkout','--orphan',branch],temp);git(['remote','add','origin',remote],temp);}
 let manifest={schema:1,latest:null,entry,versions:[]};try{manifest=JSON.parse(await readFile(resolve(temp,'manifest.json'),'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
 if(!Array.isArray(manifest.versions))throw new Error('Invalid existing manifest');
 if(manifest.versions.some(v=>v.id===id)){console.log(`${id} already published; kept immutable`);}
 else {
  const destination=resolve(temp,'releases',id);await mkdir(destination,{recursive:true});await cp(dist,destination,{recursive:true});
  manifest.versions.push({id,sourceCommit:source,date,label,entry});manifest.versions.sort((a,b)=>Date.parse(a.date)-Date.parse(b.date));manifest.latest=manifest.versions.at(-1).id;manifest.entry=entry;
  await writeFile(resolve(temp,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  git(['config','user.name','Codex task publisher'],temp);git(['config','user.email','codex-publisher@users.noreply.github.com'],temp);git(['add','.'],temp);git(['commit','-m',`Publish ${id}`],temp);execFileSync('git',['push','origin',`HEAD:${branch}`],{cwd:temp,env,stdio:'inherit'});
  console.log(`Published ${id}; Finder sync will discover ${branch}`);
 }
}finally{await rm(temp,{recursive:true,force:true});}
