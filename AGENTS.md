# AGENTS.md · DSH 优化工程

本仓库给本机 DeepSeek Harness 写客户端插件。先读 `HANDOFF.md` 了解现状。

## 铁律

1. **不重启 / 不杀 DSH 进程**。任何需要重启的改动，改完告知用户，由用户重启。
2. **改配置前先备份**到 `backups/`；改完用临时 profile 校验（见 HANDOFF「硬事实 2」）。
3. **改插件源码后必须 `remove` + `add`**，否则安装副本不会更新。
4. **不要直接改安装目录** `C:\Users\14834\AppData\Local\Programs\DeepSeek Harness`（升级会覆盖）。

## 工作方式

- 改 UI 前先读 `HANDOFF.md` 的「硬事实」，别重新猜 DOM 结构。
- 一次只改一个特性，改完立刻自测（`test/` 下的脚本），绿了再动下一个。
- 测试页面必须**镜像真实编译产物结构**，不是自己想象的简化结构——本项目已经因此翻车三次。
- 每个改动在 `docs/DSH-优化记录-20261020.md` **末尾**追加一条：现象 / 根因 / 改动点 / 验证。
- 提交用 Conventional Commits。
