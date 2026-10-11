import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { DEFAULT_OWNER, validName } from './task-contract.mjs';
const execute=promisify(execFile);
export async function discoverRepositories(owner=DEFAULT_OWNER,{run=execute,fetchImpl=fetch}={}) {
 if(!validName(owner)) throw new Error('GitHub 账号名称无效');
 let repos, privateAccess=false;
 try {
  const {stdout}=await run('gh',['api','--paginate','--slurp','/user/repos?affiliation=owner&per_page=100'],{timeout:30000,maxBuffer:8*1024*1024,env:{...process.env,GH_PROMPT_DISABLED:'1'}});
  const pages=JSON.parse(stdout);if(!Array.isArray(pages))throw new Error('Invalid GitHub response');repos=pages.flat();if(!repos.some(r=>r?.owner?.login?.toLowerCase()===owner.toLowerCase()))throw new Error('CLI account differs');privateAccess=true;
 } catch {
  repos=[];
  for(let page=1;page<=100;page++) {
   const response=await fetchImpl(`https://api.github.com/users/${owner}/repos?per_page=100&page=${page}`,{headers:{Accept:'application/vnd.github+json','User-Agent':'Codex-Finder-Sync'},signal:AbortSignal.timeout(15000)});
   if(!response.ok)throw new Error(`GitHub 仓库发现失败（HTTP ${response.status}），已下载任务仍可打开`);
   const batch=await response.json();if(!Array.isArray(batch))throw new Error('GitHub 仓库列表无效');repos.push(...batch);if(batch.length<100)break;
  }
 }
 const tasks=repos.filter(r=>r?.owner?.login?.toLowerCase()===owner.toLowerCase()&&validName(r.name)).map(r=>({name:r.name,remote:`https://github.com/${owner}/${r.name}.git`}));
 return {repositories:tasks,privateAccess};
}
export async function publishedBranch(remote) {
 const {stdout}=await execute('git',['ls-remote','--heads',remote,'codex-releases'],{timeout:20000,maxBuffer:1024*1024,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
 return stdout.includes('refs/heads/codex-releases')?'codex-releases':null;
}
