# 交接：DSH 优化工程

> 换工作区后从这一页开始读。最后更新 2026-11-20 23:25。

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
| `dsh-turn-tps` | 0.3.2 | 已装 | 状态栏「本轮 tok/s」药丸 + 点击弹出用量面板 |
| `dsh-subagent-running-count` | 0.3.3 | 已装 | 胶囊只显示运行中子智能体数；花名册加创建时间、新→旧排序、超 8 条折叠 |
| `dsh-hide-completed-subagents` | 0.1.0 | 已卸载（留档） | 隐藏已完成行；被上一个取代 |

- profile 依赖：`file:C:/dev/dsh-optimize/plugins/<name>`（**绝对路径**，换机要改）
- 配置解析：**1372 行、0 异常**（用临时 profile 校验的）
- git：干净，最新提交 `8ec7c19`

## 唯一未完成的事

**需要用户重启一次 DSH。** `subagent-running-count` v0.3.3 修复了「排序/折叠不生效」的 bug，
但只在浏览器里验证过，真实界面还没看过。重启后应该：

- 胶囊：`N 个子智能体运行中`；没有运行中就只留图标（不显示 0）
- 点开面板：新的在最上、右侧有 `HH:MM` 时间、底部「显示其余 N 条」

如果重启后不对，下一步是从会话日志取时间（不再靠 React fiber），而不是继续猜 DOM。

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

- `docs/DSH-优化记录-20261020.md` —— 825 行，逐轮改动（现象/根因/改动/验证），**新改动追加在末尾**
- `docs/DSH可优化项目清单-20261120.md` —— GitHub 上 63 个可优化 DSH 的项目
- `docs/DSH生态项目清单-20261120.md` —— 同批数据的分类版
