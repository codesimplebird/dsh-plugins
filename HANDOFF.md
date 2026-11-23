# 交接：DSH 优化工程

> 换工作区后从这一页开始读。最后更新 2026-11-23 21:58（OpenCode Go 额度面板 usage-stats 0.3.8 已装待重启；见优化记录第三十一轮）。

## 这是什么

给本机 DeepSeek Harness（桌面端，DSH 0.2.2-rc.5）做定制的工程仓库。
产物是几个**客户端插件**（DOM 注入，不改 DSH 源码），以及调研文档。

## 路径

| 项 | 路径 |
|---|---|
| 本仓库 | `C:\dev\dsh-optimize` |
| DSH 家目录 | `C:\Users\14834\.dsh` |
| 生效配置（桌面 profile） | `~\.dsh\profiles\desktop\cordis.patch.yml` |
| profile 依赖 | `~\.dsh\profiles\desktop\package.json` |
| 插件安装副本 | `~\.dsh\profiles\desktop\node_modules\<插件名>` |
| DSH 安装目录（**只读**） | `C:\Users\14834\AppData\Local\Programs\DeepSeek Harness` |

## 当前状态

| 插件 | 版本 | 状态 | 作用 |
|---|---|---|---|
| `dsh-turn-tps` | 0.4.4 | 已装（刷新页面载入） | tok/s 药丸 + 用量面板；最新消息底部「任务总用时」（含重置基准）；**每条消息时间旁显示本轮模型** |
| `dsh-subagent-running-count` | 0.3.4 | 已装 | 胶囊只显示运行中子智能体数；花名册加创建时间、新→旧排序、超 5 条折叠 |
| `dsh-hide-completed-subagents` | 0.1.0 | 已卸载（留档） | 隐藏已完成行；被上一个取代 |
| `dsh-driftglass` | 1.5.0 | 已加载 | 第三方玻璃主题（Aqua 的 0.2.2 移植版），设置→通用→外观 里开关 |
| `dsh-mnemon` | 0.5.50 | 已加载 | 长期记忆（npm 源，侧栏「Memory System」）；Mnemon Native CLI 0.2.14；记忆空间「工作记忆」(`default`) 已激活 |
| `dsh-flash-presets` | 0.3.2 | 已加载（11-23 重启后） | 「精简·PTC v3」/ balance 预设；对整个 profile 覆盖 `ptc-runtime`（0.3.3 是误发版，勿装）；plan-mode-ui 组件已禁用 |
| `dsh-block-ptc` | 0.5.0 | 已加载（11-23 重启后） | Block PTC 预设/工具：AI 自主决定何时压缩上下文（需新会话选该预设） |
| `dsh-ops` | 0.5.5 | 已加载（默认隐藏 pwsh/官方工具） | ops 工具族 + 随包 bash 运行时；**当前会话工具面已从 `pwsh` 换成 `ops_bash`/`ops_*`** |
| `dsh-session-model` | 0.1.0 | 已加载（11-23 重启后） | 会话头部显示当前模型（主会话 + 子智能体会话），切换模型实时刷新 |
| `@ychris12138/dsh-usage-stats` | 0.3.8 | 已装（**待重启**） | 供应商余额/订阅额度面板：OpenCode Go 的 5 小时 / 周 / 月窗口，侧栏「用量/余额」 |
| `@xiazhi88/dshgo` | 2.0.5 | 已加载（11-22 另装） | 手机 DSH Go 局域网入口（0.0.0.0:3081 → 2939），设置里「局域网访问」 |

- profile 现在 **15 个 bundle、13 个依赖**（含 11-22 另装的 `@xiazhi88/dshgo`）
- 配置解析：**2195 行、0 异常**（含 Driftglass + mnemon + flash-presets + block-ptc + dsh-ops +
  session-model + usage-stats；唯一告警 `dsh-connect-workbuddy not found` 为安装前既有）
- git：干净，提交见 `git log -1`（切区基线 `aa08ec7`）

## 唯一未完成的事

**再重启一次 DSH**：`@ychris12138/dsh-usage-stats@0.3.8` 已装进 profile，host 半要重启才加载。
重启后侧栏底部会出现「用量/余额」：

- 选「**OpenCode Go**」卡片 → **5 小时 / 周 / 月**三条进度条 + 各自重置时间（数据源
  `opencode.ai/inference/go/v1/usage`）；侧栏标签显示「月剩余 N%」
- 点刷新可手动更新；也可开「跟随当前会话」自动跟随当前会话的 provider
- 2026-11-23 12:07 已重启加载：flash 预设、Block PTC、dsh-session-model、dsh-ops、dshgo；
  turn-tps 的每轮模型标签若没看到，**刷新页面**即可（客户端插件）
- 其余照旧：radar 增量 `docs/DSH雷达增量-最新.md`（周一 09:30 自动跑）；预设可选「精简·PTC v3」

其余状态：Driftglass、dsh-mnemon、Mnemon Native CLI 均已在跑；记忆空间「工作记忆」
（id `default`，provider `mnemon-native`）已创建并 **active**。

观察项（有问题再处理）：

- usage-stats 的 OpenCode Go 卡片若显示 unauthorized：先确认已重启，再看 `OPENCODE_API_KEY`
  是否可用（有效值在 `OPENCODE_GO_API_KEY`，2026-11-23 已对齐）
- 预设净效果：用 turn-tps 药丸对比同任务 token/轮数；flash 预设 vs 官方 PTC 预设各跑一次
- 「重置」小灰字链接（v0.4.3）；每轮模型标签是否与官方用量弹窗的「模型」行一致（v0.4.4）；
  间距偏紧/偏松只调 `TASK_TIME_GAP`
- 下一轮起 `mnemon_recall` 应可用；试一次召回看质量；玻璃主题观感：设置 → 通用 → 外观

## 这套东西的几个硬事实（别再重新发现一遍）

1. **不允许 agent 重启 DSH**（用户铁律）。改完告知用户，由他重启。
2. 桌面 profile 不能 `--dump-config`，必须复制到临时 profile + junction `node_modules` 再校验；
   删目录前先 `cmd /c rmdir` 拆掉 junction，否则会删掉真实 `node_modules`。
3. 改插件源码后**必须 `remove` + `add`**，pnpm 按 lockfile 判定会认为「已是最新」不重拷。
4. **`file:` 依赖路径失效会让所有 `dsh plugin` 命令失败**（含 `remove`），因为 pnpm 要先解析整棵依赖树。
   修法：直接改 profile 的 `package.json` 路径，再到 profile 目录手动跑
   `DeepSeek Harness.exe --expose-internals <pnpm.mjs> install --no-frozen-lockfile`。
5. 真实 DOM 里**每个花名册行外面还包一层 `<div class="node">`**；官方组件把 `createdAt` 放在
   catalog entry 里（React fiber 的 `memoizedProps.catalog.entries`），DOM 上看不到。
6. 客户端插件**拿不到认证 token，也进不了渲染进程**，所以 UI 效果只能靠
   「镜像真实结构 + Chrome headless 跑插件 bundle」自测，最终要用户截图确认。
7. **workspace-write 沙箱在新路径会全灭**：`C:\dev\dsh-optimize` 缺「写所有者」，
   `grantWrite` 报 Win32 5，pwsh/git 起不来（与旧 `C:\dev\qingjian` 同名问题）。
   本仓库核验是在 **danger-full-access** 下完成的；切回 workspace-write 前先跑
   `diagnose-windows-sandbox-acl` 补权限（备份 `C:\dev\dsh-acl-recovery`）。
8. 第三方主题用 **`github:` 源**安装（没有 npm 包）：`dsh plugin add github:user/repo#main`，
   升级＝重装同源＋重启。peer 警告 `missing @deepseek-ai/cordis` 是本 profile
   `autoInstallPeers=false` 的既有模式，不代表装坏。
9. `dsh-mnemon` 走 **npm 源**（`dsh plugin add dsh-mnemon`），**自带 bundle patch，不要把它的 insert
   复制进 profile 的 `cordis.patch.yml`**（重复 entry id 会让设置无法保存）。默认启用，重启后侧栏出现
   「Memory System」。Mnemon Native CLI 已全局安装（`npm i -g --include=optional @mnemon-dev/mnemon`，
   v0.2.14，数据目录 `C:\Users\14834\.mnemon`），必须带 `--include=optional`，否则缺平台二进制。
10. **Mnemon 的 View 在会话创建时固化**：后装的 CLI/Provider 不会让已有会话获得空间管理动作
    （报 `Source Action is not offered by the current View: memory-spaces/manage-spaces`），
    子会话还会继承父会话的 View。装完 CLI 后要**新开一个对话**（或重启 DSH）才能创建记忆空间。
    判据：每轮上下文里的 `MNEMON VIEW TOOLS (...)` 行列出了当前 View 可用的动作/路由；同轮内新建的
    空间当轮 `recall` 仍不可用，**下一轮**恢复（2026-11-21 12:00 据此建成 space id `default`）。
11. **客户端插件更新不一定需要重启整个 DSH**：刷新页面会重新拉取 profile 里的 client bundle
    （2026-11-21 实测：turn-tps v0.4.0 在 11:39 启动的进程下、14:54 安装完直接可见）。但 host 侧插件
    （如 mnemon）、`cordis.patch.yml`/bundle/preset 改动仍然必须重启 DSH。
12. **dsh-ops 默认 `hidePwsh: true` / `hideOfficialTools: true`**：装上后 agent 的工具面会从
    `pwsh`/`read`/`grep` 换成 `ops_bash`/`ops_*`（bash = 随包 niubash），**本仓库的命令示例要按 bash 写**
    （路径 `/c/...` 或 `C:/...`；调 PowerShell 用 `powershell.exe -File`）。不想这样：插件页关掉隐藏项
    重启，或 `dsh plugin remove dsh-ops`。
13. **flash-presets 只装 0.3.2**（0.3.3 是作者误发、npm 上已 deprecate；锁版本装）。
    它插入的 `ptc-runtime` 覆盖对**整个 profile 的所有预设**生效；glob/grep 并发标记可用
    `DSH_FLASH_PRESETS_CONCURRENCY=0` 关，旧 preset id 别名可用 `DSH_FLASH_PRESETS_ALIAS=0` 关。
14. **radar 增量**：`node tools/radar-refresh.mjs` 拉 dsh-plugin-radar 数据，筛 `verdict=ok`、★≥100、
    DSH 相关、不在旧清单的优化类项目 → `docs/DSH雷达增量-最新.md`；失败不覆盖旧文件。
    计划任务 `DSH-Radar-Refresh`（每周一 09:30）已注册，可 `schtasks /query /tn DSH-Radar-Refresh` 查。
15. **flash-presets 的计划组件会注入"合成用户消息"**（`dsh-plan-mode-ui`，host 半在 `dsh-flash-presets/lib/index.js`）：
    会发 `PHASE 1 / PHASE 2 / PLAN NOT FOUND / PLAN FIRST …` 开头的 steer 消息，DSH 渲染成**用户气泡**，
    看起来像用户发的（实际不是）。它把会话标成 `phase=planning` 后，一检测到文件写入就拦门插
    `PLAN NOT FOUND`。状态/开关：
    - `GET http://127.0.0.1:<GUI端口>/api/plan-mode/state` → `{tier, scope, phase, planning, …}`
    - `POST` 同地址 `{"tier":"off"}`（**必须带 `x-plan-mode-client: 1`**，否则 403）→ 关闭注入与验收
    - 持久化在 `~/.dsh/plan-mode-ui/state.json`；**2026-11-21 已设 `tier=off`**（此前被标 planning 后连续插话）
    - **彻底关闭（已做，待重启生效）**：profile `cordis.patch.yml` 末尾加
      `- id: plan-mode-ui` / `name: dsh-flash-presets` / `disabled: true`
      （备份 `backups/desktop-cordis.patch.yml.before-disable-planmode-ui-20261121`）；
      只禁用这个组件，`flash-presets-core` 两个预设照常可用；回滚就删掉这三行。
    - 作者自身的用户开关：输入区计划面板 → 档位「关闭 / 轻量 / 全量」（off = 不规划、不注入）

16. **OpenCode Go 额度查询**：`GET https://opencode.ai/inference/go/v1/usage`（Bearer = 有效
    `OPENCODE_GO_API_KEY`；旧路径 `/zen/go/v1/usage`）→ `usage.rolling/weekly/monthly`
    各含 `status/percent/resetsAt`（5 小时 / 周 / 月窗口）。面板用 `@ychris12138/dsh-usage-stats@0.3.8`
    （侧栏底部「用量/余额」）。**坑**：它默认先读 `OPENCODE_API_KEY`，只有**缺失**才回退
    `OPENCODE_GO_API_KEY`；本机 11-23 前 `OPENCODE_API_KEY` 已过期（401），已把它对齐成可用的 GO key
    （备份 `~/.dsh/backups-credentials-20261123.bak`，**凭据永不进 git**）。未加 scope 的
    `dsh-usage-stats`（npm 0.1.16）inject 了已删除的 `dsh-client-runtime`，0.2.2 上不能用。

## 自测方式

```powershell
# 胶囊逻辑（12 条断言）
node plugins\dsh-subagent-running-count\test\smoke.mjs

# 花名册：生成页面 → 真实 Chrome 跑 → 读 DOM 结果
node plugins\dsh-subagent-running-count\test\roster-browser.mjs   # 打印 html 路径
chrome --headless=new --dump-dom file:///<那个路径>
```

测试页面用「合成 fiber」喂 `createdAt`，覆盖三种 DOM 形态（含真实 wrapper 结构）。

## 文档

- `docs/DSH-优化记录-20261020.md` —— 1295 行，逐轮改动（现象/根因/改动/验证），**新改动追加在末尾**
- `docs/DSH可优化项目清单-20261120.md` —— GitHub 上 63 个可优化 DSH 的项目
- `docs/DSH生态项目清单-20261120.md` —— 同批数据的分类版
- `docs/DSH雷达增量-最新.md` —— radar 自动增量（每周一更新），由 `tools/radar-refresh.mjs` 生成
