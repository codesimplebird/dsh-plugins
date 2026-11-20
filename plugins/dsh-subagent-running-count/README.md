# dsh-subagent-running-count

两处只改显示的子智能体改动：

1. **胶囊**只显示**运行中**的数量（没有运行中就只留图标）
2. **花名册**每行显示**创建时间**；超过 5 条自动折叠，可展开

## 为什么需要它

- 胶囊渲染的是**总数**（`count.total`），完成的子智能体也计入，所以界面一直"3 个子智能体"。
- 花名册每行只有 token 数和活跃时长（`subagentTiming.settledMs`），**没有任何墙钟时间**，
  完成的项目看起来一模一样，分不出先后。
- 官方数据里其实有：catalog entry schema 带 `createdAt: number`（epoch 毫秒），只是没渲染。

## 做法

**胶囊**：官方在 `runningCount > 0` 时会渲染一个隐藏的无障碍 span（`count.running`），
直接复用它算好的数字，写回 `[data-subagent-count]` 的文本。没有这个 span 就是 0，清空文案。

**时间**：`createdAt` 不在 DOM 里，只能从 React fiber 取——从行元素向上找
`memoizedProps.catalog.entries`，建 `label/name/id -> createdAt` 映射，再用行的文本匹配，
插入 `HH:MM`（非当天则 `MM/DD HH:MM`）。取不到就**不显示**，不猜。

**折叠**：超过 5 行时隐藏其后行，追加一个「显示其余 N 条」按钮；展开后变「收起较长列表」。
展开状态记在 `WeakSet`（面板元素为键），面板关闭重开即复位。

## 测试

`test/smoke.mjs`：胶囊逻辑 12 条断言（含英文单数、0 值、React 回写自愈）。
`test/roster-browser.mjs`：生成页面，在**真实 Chrome** 里跑，用**合成 fiber** 提供
`createdAt`，断言时间列、折叠、展开、收起：

```
{"chip":"2 个子智能体运行中","totalRows":10,
 "timeStamps":["22:34","22:33",...],
 "visibleBeforeExpand":5,"toggleLabel":"显示其余 5 条",
 "visibleAfterExpand":10,"toggleLabelAfterExpand":"收起较长列表"}
```

```powershell
chrome --headless=new --dump-dom file:///.../roster.html    # 先 node test/roster-browser.mjs 生成
```

## 已知边界

- **DOM / React 内部耦合**：fiber 结构变化时时间列消失（其余功能不受影响）；胶囊依赖
  `data-subagent-count` 与隐藏 span 结构。
- 时间匹配用行文本包含关系，理论上相同 label 会串（实际很少）。
- 只改显示：不写数据、不发请求、不点任何元素。
- 时间来自 `createdAt`，非「最后活动时间」。
