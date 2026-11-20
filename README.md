# DSH 优化工程

这台机器上所有「优化 DSH」的工作集中在这里，带 git 版本控制。

## 结构

```
C:\dev\dsh-optimize\
├─ plugins\     自制 DSH 插件源码（通过 file: 安装到 profile）
├─ docs\        优化记录、GitHub 项目清单
├─ backups\     改配置前的备份
└─ lab\         浏览器测试页、预览截图
```

## 插件

| 插件 | 作用 | 状态 |
|---|---|---|
| `dsh-turn-tps` | 状态栏「本轮 tok/s」药丸 + 底部用量面板 | 已装 |
| `dsh-subagent-running-count` | 胶囊只显示运行中子智能体数；花名册加创建时间、新→旧、超 8 条折叠 | 已装 |
| `dsh-hide-completed-subagents` | 隐藏已完成行 | 已卸载，留档 |

安装方式（profile 用**绝对路径**引用源码，换机器要改路径）：

```powershell
dsh plugin --profile desktop add file:C:\dev\dsh-optimize\plugins\dsh-turn-tps
dsh plugin --profile desktop add file:C:\dev\dsh-optimize\plugins\dsh-subagent-running-count
```

**改完源码必须 `remove` + `add`**，否则 pnpm 按 lockfile 判定「已是最新」不会重拷。

## 路径速查

| 项 | 路径 |
|---|---|
| DSH 家目录 | `C:\Users\14834\.dsh` |
| 生效配置 | `~\.dsh\profiles\desktop\cordis.patch.yml` |
| profile 依赖 | `~\.dsh\profiles\desktop\package.json` |
| 安装目录（只读，别动） | `C:\Users\14834\AppData\Local\Programs\DeepSeek Harness` |

## 验证套路

改 `cordis.patch.yml` 后，复制到临时 profile 跑配置校验（桌面 profile 不能直接 `--dump-config`）：

```powershell
# 复制 cordis.patch.yml / cordis.yml / package.json / compatibility.json
# junction 指向真实 node_modules，跑 dsh --profile <tmp> --dump-config
# 结束前先 rmdir junction，再删目录（否则会删掉真实 node_modules）
```

插件自带测试：

```powershell
node plugins\dsh-subagent-running-count\test\smoke.mjs
node plugins\dsh-subagent-running-count\test\roster-browser.mjs   # 生成页面后用 Chrome headless 跑
```

## 铁律

- **不重启 DSH**：需要重启的改动改完告知用户，由用户重启。
- 动配置前先备份到 `backups/`。
