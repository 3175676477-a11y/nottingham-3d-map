const command=`(
  set -e
  codex_setup_dir=$(mktemp -d "\${TMPDIR:-/tmp}/codex-setup.XXXXXX")
  trap 'rm -rf "$codex_setup_dir"' EXIT
  git clone --depth 1 --single-branch --branch codex/sherwood-hall-map https://github.com/3175676477-a11y/nottingham-3d-map.git "$codex_setup_dir/source"
  node "$codex_setup_dir/source/scripts/install-local.mjs"
)`;
document.getElementById('command').textContent=command;
document.getElementById('copy').onclick=async()=>{try{await navigator.clipboard.writeText(command);document.getElementById('copy').textContent='已复制，请在 Mac 终端粘贴运行';}catch{document.getElementById('copy').textContent='请选中下方代码手动复制';}};
fetch('/api/status',{cache:'no-store'}).then(r=>r.json()).then(s=>{const box=document.getElementById('status');if(s.organizerVersion===1){box.textContent='自动同步器已运行。';const a=document.createElement('a');a.href='/tasks.html';a.textContent=' 查看同步状态 ↗';box.append(a);}else box.textContent='当前是旧版单仓库服务，需要运行下方代码升级一次。';}).catch(()=>{document.getElementById('status').textContent='尚未连接本机同步器，请在 Mac 上运行下方安装代码。';});
