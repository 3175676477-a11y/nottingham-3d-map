# Mac 固定入口与云端历史版本

安装只需做一次（已安装 Node.js 和 Git 的 Mac）：

```bash
cd ~/nottingham-3d-map-fixed &&
git pull --ff-only origin codex/sherwood-hall-map &&
npm run install:local
```

安装会自动打开网页，并在桌面建立两个链接：

- **打开日地月**：`http://127.0.0.1:43173/`，每次打开会检查云端版本，再进入最新版。
- **日地月历史版本**：`http://127.0.0.1:43173/versions.html`，可以直接打开旧版本。

网页顶部也能返回最新版或查看历史版本。打开旧版不会替换云端最新版。
短时间内重复打开会合并更新检查；已经打开的观测页面固定在该版本，
不会在观察途中被新版本打断。再次点击桌面链接即检查更新。

本机使用登录后自动运行的后台服务，无须保持终端窗口。所有运行文件和
下载的版本位于 `~/Library/Application Support/SolarAtlas/`；不会改动开发
项目里的本地文件。联网失败时保留并打开已下载的版本，页面提示更新检查失败。
首次下载、以及尚未下载的新版本需要网络连接。

云端源码保存在 Git 提交记录中；可运行的构建快照保存在仓库的
`solar-atlas-releases` 分支。每次发布新增一个独立版本，不覆盖旧版本。
源分支推送会触发归档工作流，也可运行 `npm run release` 直接发布已提交的代码。

服务日志在 `~/Library/Application Support/SolarAtlas/logs/`。
安装脚本需要在真实 Mac 上执行；Linux 云环境验证的是本地服务的更新、
历史版本、离线回退和文件访问行为，不能代替 macOS 的 launchd 实机验证。

如需停止开机启动（不会删除任何历史数据）：

```bash
launchctl bootout "gui/$(id -u)/com.solaratlas.local"
rm ~/Library/LaunchAgents/com.solaratlas.local.plist
```
