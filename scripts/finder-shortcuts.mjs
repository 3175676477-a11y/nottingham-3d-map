import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { resolve } from 'node:path';
import { DEFAULT_PORT } from './local-server.mjs';

export const FINDER_TASK_FOLDER = 'Codex任务';
export const REPOSITORY_FOLDER = 'nottingham-3d-map';
export function finderShortcuts() {
  return [
    { name: '最新版本.webloc', url: `http://127.0.0.1:${DEFAULT_PORT}/` },
    { name: '历史版本.webloc', url: `http://127.0.0.1:${DEFAULT_PORT}/versions.html` },
  ].map(link => ({ ...link, contents: `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">\n<plist version="1.0"><dict><key>URL</key><string>${link.url}</string></dict></plist>\n` }));
}
export async function installFinderShortcuts(home = homedir()) {
  const directory = resolve(home, 'Documents', FINDER_TASK_FOLDER, REPOSITORY_FOLDER);
  await mkdir(directory, { recursive: true });
  for (const link of finderShortcuts()) await writeFile(resolve(directory, link.name), link.contents);
  return directory;
}
