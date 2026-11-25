# dsh-hide-completed-subagents

把 DSH「子智能体」花名册里**已完成**的行隐藏掉，只留正在运行 / 未运行 / 外部任务。

## 为什么需要它

DSH 0.2.2 的 `@deepseek-ai/dsh-client-ui-subagent` 把每个子智能体都留在花名册里（方便点开回看执行记录），
而且**没有任何开关**：web-app patch 里 `ui-subagent` 行没有 config，客户端包里 `Schema` / `settings` 出现 0 次。

## 做法

纯 DOM 过滤，不改官方组件、不改数据：

| 钩子 | 用途 |
|---|---|
| `[data-subagent-panel]` | 花名册浮层（portal 到 body） |
| `[role="treeitem"]` | 一行子智能体 |
| `aria-label` | 状态文案的载体 |

关键点：**状态文字不是可见文本**。行里只渲染标题和会话 id，`mode · activity` 只拼进 `aria-label`
（源码 `secondary = [secondaryLabel, mode, activity].join(' · ')`）。所以判断依据是
`aria-label` 是否含 `activity.completed` 的本地化文案。

匹配：`/已完成|\bcompleted\b/i` → 加类 `.dsh-hide-completed-subagent-row` → `display:none`。
`正在运行` / `当前未运行` / 外部任务不受影响。

用 `MutationObserver`（`childList` + `subtree` + `aria-label`）配合 `requestAnimationFrame` 合并重扫，
面板每次打开、展开子分支、状态更新都会重新打标。

## 安装 / 卸载

```powershell
dsh plugin --profile desktop add file:%USERPROFILE%\.dsh\plugins\dsh-hide-completed-subagents
dsh plugin --profile desktop remove dsh-hide-completed-subagents
```

改源码后必须 `remove` + `add` 才会重拷（pnpm 对 `file:` 按 lockfile spec 判定）。

## 已知边界

- **DOM 耦合**：依赖 `data-subagent-panel` / `role=treeitem` / `aria-label` 三处。官方若改结构，过滤器失效
  → 退化成「全部显示」，不会报错。
- **文案匹配**：按中英文 `已完成` / `completed` 判断。其他语言界面下不生效（同样只是不隐藏）。
- **误判可能**：如果某个子智能体的**标题本身**含「已完成」，它会被误隐藏。概率低，但存在。
- 只影响显示，**不改数据**：子智能体记录、可继续会话、侧边栏打开历史都仍然可用（只是这一行不显示）。
