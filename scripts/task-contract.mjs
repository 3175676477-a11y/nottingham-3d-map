export const DEFAULT_OWNER = '3175676477-a11y';
export const TASK_BRANCH = 'codex-releases';
export const validName = name => typeof name === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(name);
export const validEntry = entry => typeof entry === 'string' && /^(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\.html$/.test(entry);
export const validReleaseId = id => /^v-[0-9a-f]{12}$/.test(id || '');
export function validateManifest(data) {
  if (!data || !validReleaseId(data.latest) || !Array.isArray(data.versions) || !data.versions.some(v=>v.id===data.latest)) throw new Error('发布目录不完整');
  if (data.entry !== undefined && !validEntry(data.entry)) throw new Error('网页入口路径无效');
  for(const v of data.versions) if(!validReleaseId(v.id) || (v.entry!==undefined && !validEntry(v.entry))) throw new Error('历史版本目录无效');
  return data;
}
