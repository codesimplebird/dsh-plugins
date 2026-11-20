# dsh-turn-tps

在 DSH 输入框下方的 composer dock 里，为**当前轮**加一个药丸：常驻显示速度与输出量，点开看这一轮的完整明细。

## 参照

- **Claude Code 的 statusline**：状态行只放高信号字段（`model.display_name`、`context_window.used_percentage`、`total_cost_usd`），其余细节交给 `/statusline` 命令或弹层。结论是「常驻窄、细节可展开」。
- **DSH 自己**的 `StatsPills` / `stat-dialog`（`packages/client/ui-chat`）：药丸是 `<button aria-haspopup="dialog">`，点开在 `document.body` 上 portal 一个面板。本插件沿用同一套交互，视觉上也用同一批 `--dsw-alias-*` token。

## 显示

常驻（收起态）：

```
⚡ 本轮 159 tok/s · 1.2K tok
```

点开面板「本轮用量」：

| 行 | 含义 |
|---|---|
| 步骤数 | 本轮包含的 step 数 |
| 输出 Token | 本轮累计输出 |
| 生成用时 | 纯解码时间 |
| 首 Token | TTFT |
| 工具用时 | 工具调用耗时 |
| 本轮用时 | 墙钟时间 |
| 缓存命中 | token 加权缓存读取占比 |
| 重试 / 工具错误 | 仅在 >0 时出现 |

底部一行给出「第 N 轮 · 生成中/已完成/已中断」。数据仍在计算中的字段显示 `…`。

## 数据来源

```js
ctx.uiConversation.binding(sessionId).target('stats').getSnapshot()
// { turns: StatsTurnMetrics[], stepCount }
```

`.target()` 由首个订阅者激活，不需要打开「统计」标签页。依赖
`@deepseek-ai/dsh-experimental-client-ui-stats` 处于启用状态；没有它时本插件**静默不显示**。

取用的是 `StatsTurnMetrics` 的 `tps / output / decode / ttft / tool / wall / cacheHit / retries / toolErrors / wall / running / interrupted / aborted`。

## 样式约束

按官方 `docs/web-styling.zh.md`：只用 `--dsw-alias-*` 语义 token，不写颜色字面量。

强调色是 `--dsw-alias-state-business-primary` → `--dsw-static-deepseek-500` → `#4176e6`。
**不要**用 `--dsw-alias-brand-primary`：它在暗色主题里是 `neutral-bluish-1000`（近白墨色），
渲染出来是灰白药丸而不是强调色。

## 安装 / 卸载

```powershell
dsh plugin --profile desktop add file:C:\Users\14834\.dsh\plugins\dsh-turn-tps
dsh plugin --profile desktop remove dsh-turn-tps
```

改源码后必须 `remove` + `add` 才会重拷（pnpm 对 `file:` 按 lockfile spec 判定，`--force` 无效）。

## 已知风险

- 依赖官方**实验**包；该包若改字段，需要同步 `buildRows` 与 `turnTps`。
- 所有读取路径都包在 try/catch 里，异常时药丸消失，不影响 composer。
