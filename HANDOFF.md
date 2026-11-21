# 交接：DSH 优化工程

> 换工作区后从这一页开始读。最后更新 2026-11-21 19:48（turn-tps v0.4.3 修「重置」被主题按钮样式覆盖；见优化记录第二十四～二十七轮）。

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
| `dsh-turn-tps` | 0.4.3 | 已装（刷新页面载入） | tok/s 药丸 + 用量面板；最新消息底部「任务总用时」（含「重置/恢复」基准） |
| `dsh-subagent-running-count` | 0.3.4 | 已装 | 胶囊只显示运行中子智能体数；花名册加创建时间、新→旧排序、超 5 条折叠 |
| `dsh-hide-completed-subagents` | 0.1.0 | 已卸载（留档） | 隐藏已完成行；被上一个取代 |
| `dsh-driftglass` | 1.5.0 | 已加载 | 第三方玻璃主题（Aqua 的 0.2.2 移植版），设置→通用→外观 里开关 |
| `dsh-mnemon` | 0.5.50 | 已加载 | 长期记忆（npm 源，侧栏「Memory System」）；Mnemon Native CLI 0.2.14；记忆空间「工作记忆」(`default`) 已激活 |

- profile 依赖：`file:C:/dev/dsh-optimize/plugins/<name>`（**绝对路径**，换机要改）
- 配置解析：**1448 行、0 异常**（含 Driftglass + mnemon patch；源文件 `cordis.patch.yml` 636 行，
  1448 指 `--dump-config` 输出行数；唯一告警 `dsh-connect-workbuddy not found` 为安装前既有）
- git：干净，提交见 `git log -1`（切区基线 `aa08ec7`）

## 唯一未完成的事

**让客户端重新加载即可**：`dsh-turn-tps` **v0.4.3**（重置基准 + 修主题覆盖按钮样式）已于 19:48
装进 profile。**刷新 DSH 页面**（Ctrl+R / 关掉窗口重开）——客户端插件刷新即重新拉 bundle（实测无需重启整个 DSH）。

刷新后验证：

- 「任务总用时」在操作行**下一行**、小号灰字、间距约 4px（v0.4.1 已修）
- 行内「**重置**」应是**小号灰字链接**（默认无下划线、悬停变亮+下划线）——v0.4.3 用内联 `!important`
  兜底，玻璃主题不能再把它覆盖成灰块
- 点「**重置**」→ `0 秒 · 自本轮起`、按钮变「**恢复**」；等一轮结束看数字增长；刷新页面基准应保留
- 「恢复」回到整个会话累计

其余状态：Driftglass、dsh-mnemon、Mnemon Native CLI 均已在跑；记忆空间「工作记忆」
（id `default`，provider `mnemon-native`）已创建并 **active**。

观察项（有问题再处理）：

- 间距偏紧/偏松只调 client.js 的 `TASK_TIME_GAP`
- 下一轮起 `mnemon_recall` 应可用；试一次召回看质量
- 每轮上下文开销（用 turn-tps 药丸看）；玻璃主题观感：设置 → 通用 → 外观

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

- `docs/DSH-优化记录-20261020.md` —— 1147 行，逐轮改动（现象/根因/改动/验证），**新改动追加在末尾**
- `docs/DSH可优化项目清单-20261120.md` —— GitHub 上 63 个可优化 DSH 的项目
- `docs/DSH生态项目清单-20261120.md` —— 同批数据的分类版
