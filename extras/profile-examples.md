# profile 配置片段（可直接粘贴到 `%USERPROFILE%\.dsh\profiles\<profile>\cordis.patch.yml` 末尾）

> 改完重启 DSH 生效；改前先备份原文件。profile 的补丁层是**整体替换**语义：
> 覆盖某一行时要把该行需要的全部键写全。

## 1. 对话页「统计」标签页（官方实验包，默认关闭）

```yaml
- insert:
    - id: client-ui-stats
      name: '@deepseek-ai/dsh-experimental-client-ui-stats'
```

随 DSH 0.2.2-rc.5 内置在 app.asar，**不要**从 npm 安装（npm 上版本更旧）。
详见 [docs/DSH统计面板-推荐说明.md](../docs/DSH统计面板-推荐说明.md)。

## 2. 历史会话全文搜索（FTS5）

```yaml
- id: session-query-sqlite
  config:
    path: !!js dshHomePath('storages/session-search.sqlite')
    openAt: first-search
```

首次搜索时才打开/建索引；数据库落在 `~/.dsh/storages/session-search.sqlite`。

## 3. 免费联网搜索（替代失效的 deepseek-official 搜索）

```powershell
dsh plugin --profile <profile> add "@liustack/modsearch@5.10.16"
```

该包自带 bundle patch：把 web 接缝的 `searchProvider` 改成 `modsearch`，`fetchProvider` 仍为 `http`；
内置 `web_search` 保留并改走免费引擎链，另注册 `x_search` / `read_page`。装完重启。

## 4. 关闭 flash-presets 的计划模式组件

```yaml
- id: plan-mode-ui
  name: dsh-flash-presets
  disabled: true
```

只禁用计划模式组件，两个预设（`flash-presets-core`）保留可用。

## 5. 主 pro 规划 / 子 flash 执行

见 [planner-executor/README.md](planner-executor/README.md)。

## 6. 安装本仓库的插件

```powershell
dsh plugin --profile <profile> add "file:<本仓库路径>\plugins\dsh-turn-tps"
dsh plugin --profile <profile> add "file:<本仓库路径>\plugins\dsh-session-model"
dsh plugin --profile <profile> add "file:<本仓库路径>\plugins\dsh-todo-finalizer"
```

客户端插件重启后刷新页面即可看到效果；宿主插件（todo-finalizer）需要重启。
