# Mac 固定入口与云端历史版本

当前推荐自动同步模式，详见 [自动归档说明](automatic-delivery.md)。

一次性安装或升级：在 Mac 上用 Node 运行本仓库的 `scripts/install-local.mjs`。
网页顶部“自动归档”提供完整的复制命令，临时安装文件使用系统临时目录，
不需要将文件保存到 Downloads，也不需要安装 npm 依赖。

后台服务每 5 分钟发现 GitHub 账号 `3175676477-a11y` 的已发布网页仓库，
自动建立 `~/Documents/codex/<仓库>/最新版本.webloc` 与 `历史版本.webloc`。
空仓库或只有源码的仓库会等待 Codex 按交付约定发布；当前环境之外的 Codex
任务也需要配置相同发布规则，不能假设安装本机服务就会影响所有云端任务。

原桌面“打开日地月”和“日地月历史版本”以及 43173 根地址继续有效。
本机缓存和日志仍位于 `~/Library/Application Support/SolarAtlas/`。
任务状态页为 `http://127.0.0.1:43173/tasks.html`。
每个仓库使用自己的路由和构建缓存，历史版本不覆盖。断网时保留已下载版本。

安装脚本需要在真实 Mac 上执行。Linux 测试验证同步、文件布局、版本切换和
下载逻辑，不能代替 macOS launchd/TCC 实机验证。

停止登录后台服务（保留缓存与历史数据）：

```bash
launchctl bootout "gui/$(id -u)/com.solaratlas.local"
```
