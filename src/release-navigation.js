export function installReleaseNavigation(selector) {
  const version = import.meta.env.VITE_RELEASE_ID;
  if (!/^v-[0-9a-f]{12}$/.test(version || '')) return;
  const slot = document.querySelector(selector);
  if (!slot) return;
  const history = document.createElement('a');
  history.href = new URL('../../versions.html', location.href).href;
  history.textContent = '历史版本'; history.style.color = 'inherit';
  const latest = document.createElement('a');
  latest.href = new URL('../../', location.href).href;
  latest.textContent = '打开最新版'; latest.style.color = 'inherit';
  const finder = document.createElement('a');
  finder.href = new URL('./finder.html', location.href).href;
  finder.textContent = '访达文件夹'; finder.style.color = 'inherit';
  slot.replaceChildren(document.createTextNode(`${version} · `), history, document.createTextNode(' · '), latest, document.createTextNode(' · '), finder);
  if (['localhost', '127.0.0.1'].includes(location.hostname)) {
    fetch('/api/status', { cache: 'no-store' }).then(r => r.json()).then(status => {
      if (status.offline) slot.append(document.createTextNode(' · 更新检查失败，使用本地版本'));
    }).catch(() => {});
  }
}
