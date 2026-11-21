# dsh-session-model

在**会话头部**显示当前对话使用的模型（主会话和子智能体会话都有），切换模型时实时更新。

```
[ Deepseek-V4.1-Flash · max ]        ← 头部右侧的小徽章
```

## 它解决什么

DSH 默认只在输入区的模型选择器里显示当前模型；打开一个会话（尤其是从花名册点开的子智能体会话）时，
看不出这个对话用的是哪个模型。这个插件在 `conversation.session.header.utilities` 插槽加一个只读徽章：

- 主会话：显示当前选中模型 + reasoning effort
- 子智能体会话：同样显示该子会话自己的模型（官方的模型选择器对子会话不可用，但徽章仍可读它的
  `modelSelection` 投影）
- 切换模型（输入区选择器或 `/model`）后，徽章通过订阅自动刷新，无需重开页面
- 悬停显示完整身份：`模型: <provider 名> / <模型名> · <effort>`

## 数据来源

1. `ctx.sessions.binding(sessionId).session.projections.faceOf('modelSelection')`
   → `{ lastUsed, pending }`，与官方模型选择插件同源；`pending`（已记录但尚未实际使用）优先于 `lastUsed`
2. 可选：`ctx.get('modelDirectories').directoryFor(sessionId).store`
   → 提供 provider/model 的友好名称和 `retainedEffort`；对“已寻址的子智能体会话”这个服务不可用时
   自动退回投影里的原始 id

任何一步拿不到数据（会话还没绑定、投影缺失、服务未加载）都只是**不显示徽章**，不会影响会话头部。

## 安装

```powershell
dsh plugin --profile desktop add file:C:\dev\dsh-optimize\plugins\dsh-session-model
```

装完需要重启 DSH（host 侧 bundle 列表变化）。

## 测试

```powershell
node plugins\dsh-session-model\test\badge.mjs   # 生成测试页
chrome --headless=new --dump-dom file:///<测试页>
```

断言覆盖：插槽注册（名字/id/order/locale）、投影路径（子会话）、pending 优先、订阅后实时更新、
模型目录的友好名称与标题、空投影隐藏、畸形投影忽略。当前版本 `0.1.0`。
