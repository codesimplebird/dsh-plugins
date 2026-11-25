# planner-executor 预设（主 pro 规划 / 子 flash 执行）

一份自定义 agent 预设：**主会话**用较强模型做分析与规划，**子代理**统一用便宜模型承担执行，
把贵模型的 token 花在思考上、把执行量摊给便宜模型。

## 安装

```powershell
# 1) 把本目录复制到 DSH 家目录的预设目录
$dest = "$env:USERPROFILE\.dsh\.agent-presets\planner-executor"
New-Item -ItemType Directory -Force $dest | Out-Null
Copy-Item preset.yml, agent.cordis.yml $dest -Force
```

2. 在 DSH「设置 → 预设」里选择「标准模式(子代理 Flash)」，或把 profile `cordis.patch.yml` 的
   `agent-preset-registry` 默认值改成 `planner-executor`：

```yaml
- id: agent-preset-registry
  config:
    default: planner-executor
    selectedDefault: planner-executor
```

3. 主模型在「设置 → 默认模型」里保持你想要的强模型（例如 `deepseek-v4-pro`，high effort）；
   子代理模型在 `agent.cordis.yml` 的 `tool-subagent` / `tool-subagent-fork` 段里设置，
   **新会话生效**。

## 说明

- 本预设基于 DSH 官方 `standard` 预设修改；DSH 升级后建议和官方 preset 重新比对。
- 文件来自 [`codesimplebird/dsh-all-in-one`](https://github.com/codesimplebird/dsh-all-in-one)（MIT），
  这里保留作可复用示例。
