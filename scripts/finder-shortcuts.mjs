import { mkdir, writeFile, lstat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { DEFAULT_PORT } from './local-server.mjs';

import { validName } from './task-contract.mjs';
export const FINDER_TASK_FOLDER = 'codex';
export const REPOSITORY_FOLDER = 'nottingham-3d-map';
export function finderShortcuts(base = `http://127.0.0.1:${DEFAULT_PORT}`) {
  return [
    { name: '最新版本.webloc', url: `${base}/` },
    { name: '历史版本.webloc', url: `${base}/versions.html` },
  ].map(link => ({ ...link, contents: `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>URL</key><string>${link.url}</string></dict></plist>\n` }));
}
export async function installFinderShortcuts(home = homedir(), repository = REPOSITORY_FOLDER, base) {
  if(!validName(repository))throw new Error('仓库名称无效');
  const root=resolve(home, 'Documents', FINDER_TASK_FOLDER), directory = resolve(root,repository);
  for(const path of [root,directory]) {
    try { const info=await lstat(path);if(info.isSymbolicLink()||!info.isDirectory())throw new Error('任务目录不是普通文件夹：'+path); }
    catch(error) { if(error.code!=='ENOENT')throw error;await mkdir(path,{recursive:true}); }
  }
  for (const link of finderShortcuts(base)) {
    const file=resolve(directory,link.name);
    try { if((await lstat(file)).isSymbolicLink())throw new Error('快捷方式是符号链接：'+file); }catch(error){if(error.code!=='ENOENT')throw error;}
    await writeFile(file,link.contents);
  }
  return directory;
}
