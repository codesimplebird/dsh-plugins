# AGENTS.md · 本仓库的工作约定

本仓库收集面向 DeepSeek Harness（DSH）的插件与配置优化。给在本仓库工作的 agent：

## 铁律

1. **不重启 / 不杀 DSH 进程**。装插件、改 `cordis.patch.yml`、改预设等需要重启的改动，做完**告知用户**，由用户自己重启。
2. **改配置前先备份**到 `backups/`（已被 `.gitignore` 排除，不入库）。
3. **改插件源码后必须 `remove` + `add`** 重装，否则 profile 里不会更新。
4. **不要直接改 DSH 安装目录**（`Programs\DeepSeek Harness\...`，升级会覆盖）。

## 工作方式

- 一次只改一个特性；改完立即自测，绿了再动下一个。
- 测试页必须**镜像真实 DOM 结构**，不要自造简化结构。
- 每个改动在 `docs/DSH-优化记录-20261020.md` **末尾**追加一条：现象 / 根因 / 改动 / 验证。
- 提交用 Conventional Commits。
- 待办只记 agent 自己要做的事；用户动作（重启、截图确认）不要写进待办，回合结束前清空过期项。
- 不要把任何密钥、cookie、会话数据写进仓库（`.credentials.yaml`、`sessions/`、`storages/`、`backups/` 均已忽略）。

## 快速参考

- `plugins/` 下每个插件都有自己的 README + test 目录，安装方式见根 README。
- `extras/profile-examples.md` 是可直接粘贴到 profile `cordis.patch.yml` 的配置片段。
- `.dsh` 家目录默认在 `%USERPROFILE%\.dsh`；profile 在 `%USERPROFILE%\.dsh\profiles\<name>\`。
