# 一键启停脚本（Windows / dsh web）

双击 `Start-DSH-Web.bat` 会先尝试用 `dsh-autostart` 的守护进程在**隐藏窗口**启动 `dsh web`
（崩溃自动重启），然后给出菜单：`start / stop / restart / status`；服务已在运行时直接打开浏览器。

## 前置

```powershell
npm install -g @deepseek-ai/dsh dsh-autostart
```

- 默认端口 `3080`；改脚本顶部的 `set PORT=3080` 即可。
- 脚本会做一次非阻塞版本检查；`stop` 通过 sentinel 文件通知守护进程，不要直接 taskkill。
- 适配自 [`codesimplebird/dsh-all-in-one`](https://github.com/codesimplebird/dsh-all-in-one)（MIT）。
  如果你的 DSH 是桌面版（Electron），不需要这个脚本，直接用桌面端启动即可。
