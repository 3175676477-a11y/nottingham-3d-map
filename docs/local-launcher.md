# Mac 固定入口与云端历史版本

安装只需做一次（已安装 Node.js 和 Git 的 Mac）：

```bash
cd ~/nottingham-3d-map-fixed &&
git pull --ff-only origin codex/sherwood-hall-map &&
npm run install:local
```

安装会自动打开网页和访达中的仓库文件夹，建立以下入口：

```text
~/Documents/Codex任务/
└── nottingham-3d-map/
    ├── 最新版本.webloc
    └── 历史版本.webloc
```

- **最新版本**：`http://127.0.0.1:43173/`，每次打开会检查云端版本，再进入最新版。
- **历史版本**：`http://127.0.0.1:43173/versions.html`，可以直接打开旧版本。

安装同时保留原来的桌面“打开日地月”和“日地月历史版本”快捷方式。

**已安装用户整理访达文件夹不需要重新安装服务，也不需要终端命令。**
重新打开最新版，点击网页顶部“访达文件夹”，下载 `Codex任务.zip`，在访达
解压并把 `Codex任务` 拖入“文稿”。已有同名总文件夹时只放入仓库子文件夹，
保留其他任务。也可以手动新建同样的目录，把原桌面两个快捷方式复制进去并
分别改名为“最新版本”和“历史版本”，效果相同。

这些是 `.webloc` 网页入口，可以移动目录，也可以把总文件夹加入访达侧栏。
当前下载包只含本仓库；其他仓库应配置自己的最新/历史地址，不能都指向
本项目的 43173 端口。云端构建与源代码不存放在这两个快捷方式里。

网页顶部也能返回最新版或查看历史版本。打开旧版不会替换云端最新版。
短时间内重复打开会合并更新检查；已经打开的观测页面固定在该版本，
不会在观察途中被新版本打断。再次双击“最新版本”即检查更新。

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

下载包 `public/finder-shortcuts.zip` 中的两个入口与
`scripts/finder-shortcuts.mjs` 共用相同的目录/URL 约定。若更改固定地址，
同步更新下载包；发布构建会通过 Vite public 目录将它复制到每个新快照中。
