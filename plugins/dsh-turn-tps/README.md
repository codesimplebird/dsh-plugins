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

## 消息底部：任务总用时

在**最新一条消息**的操作行（复制/赞/踩/思考/分享 + `用量 1.4M tok` + 时间）**下面**，
追加一行：

```
任务总用时 1 小时 2 分
```

- 数值 = 当前会话所有轮次 `wall` 之和（来自同一个 stats 快照），不是估算；设置基准后按
  下面的「重置基准」规则累计。
- 只标注最新一条消息；旧消息不重复。
- **重置基准 / 从本轮起累计（v0.4.2）**：注记文字右侧（同一行，不是操作行里的独立按钮）有一个
  **低调的文字链接**「重置」（默认无下划线、半透明，悬停才变亮并出现下划线）。点击时记下
  「当前最后一轮」的索引与该轮当时的 `wall`，此后显示的
  数值 = `重置点之后各轮 wall 之和 + max(0, 当前轮 wall − 重置时该轮 wall)`：点击瞬间为 0，
  当前轮继续生成会递增，之后新开的轮次全额计入；文字尾部追加「· 自本轮起」，按钮变为「恢复」。
  再点「恢复」会清空基准、删掉存储项，回到「整个会话累计」。
- 按钮外观**不依赖注入的样式表**：文字链接的尺寸/颜色/背景/边框等用**内联 `!important`** 写入
  （`styleTaskButton()`）。原因是玻璃主题（Driftglass 等）会给所有 `<button>` 加更高权重的样式，
  只用 class 会渲染成系统默认灰块（v0.4.3 修复）。悬停高亮同样走内联，不依赖 `:hover` 规则。
- 按钮是真正的 `<button type="button">`，但去掉了一切原生外观（背景/边框/圆角/阴影/内边距/
  字体继承文字），所以视觉上就是一行小字链接，不会在页脚里多出一个"按钮"。
- 基准按**会话**持久化：`localStorage` 的 `dsh-turn-tps:task-baseline:<sessionId>`
  （值为 `{"baseIndex":N,"baseWall":ms}`），刷新/重开同一会话仍然生效；切换会话互不影响。
  拿不到会话 id 时只在内存生效，不会用全局 key 串会话。`localStorage` 的读写全部包在
  try/catch 里（隐私模式、`file://` 下不可用时静默退回内存）。
- 重置/恢复的点击已 `preventDefault` + `stopPropagation`，不会触发消息复制等行内点击行为。
- 定位方式：找 `button[aria-haspopup="dialog"]` 且文本以「用量 / Usage」开头的元素，
  优先用官方稳定属性 `closest('[data-clock]')` 拿到真正的操作行；没有该属性时退回
  「带时间子元素、且父级是列布局」的文本启发式，再不行才用旧的同级时间行兜底。
- 插入位置：该行之后、行的父容器里（真实结构下即 `.TurnTailNodeView_root`，成为
  actions 行的下一个兄弟）；插完用 `getBoundingClientRect()` 校验确实在新一行，
  若父级仍是 flex 行则最多向上重试 3 层。
- 样式：字号 / 行高 / 颜色从行内时间元素（整段文本形如 `15:05` 的 span）的
  `getComputedStyle` 复制成内联样式；列 `gap:16px` 会用一次性的负 `margin-top`
  压到约 4px。只在重新插入时校准，不逐帧修改。
- 组件被 React 重渲染擦掉后，`MutationObserver` 会重新补上；数据为空时自动移除。
  观察器带「当前节点 + 行」缓存：位置和文本都没变时直接返回，不做全文档扫描。
- 设置里没有任何开关，卸载插件即恢复原样。

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
