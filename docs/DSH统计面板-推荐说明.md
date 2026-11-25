# DSH「统计」面板推荐说明

DSH 对话页里的 **对话 / 轨迹 / 统计** 三个标签页，其中「统计」来自官方实验包：

- 包名：`@deepseek-ai/dsh-experimental-client-ui-stats`
- 它随 DSH **0.2.2-rc.5 起**内置在应用里（`resources/app.asar` 内，版本号与 DSH 一致），**默认不启用**
- 只有浏览器端代码；每轮 / 每步骤显示 TPS、Token、缓存命中率、模型用时、工具用时、上下文增量，
  支持「最新 / 累计」「展开全部」「显示事件行」等视图
- 不是插件市场里的包；npm 上的 `@deepseek-ai/dsh-experimental-client-ui-stats` 是旧的
  0.2.2-alpha.2，**不要用 `dsh plugin add` 安装**，用 DSH 自带的那份

## 开启方法（一行配置 + 重启）

编辑自己 profile 的 `cordis.patch.yml`：

- Windows 默认：`C:\Users\<你>\.dsh\profiles\desktop\cordis.patch.yml`（网页版是 `profiles\web\...`）
- 在文件末尾追加：

```yaml
# 官方实验包：对话视图的「统计」标签页（默认未启用）
- insert:
    - id: client-ui-stats
      name: '@deepseek-ai/dsh-experimental-client-ui-stats'
```

然后重启 DSH（桌面端退出重开；网页版重启 `dsh` 进程），进入任意会话即可看到「统计」标签页。

## 补充

- 「轨迹」标签页是另一个官方包 `@deepseek-ai/dsh-client-ui-trajectory`，DSH 默认就启用，不需要改配置
- 该实验包也是 turn-tps 药丸 / 用量面板的每轮数据来源；两者可以搭配使用
- 属于 `experimental` 包：官方不承诺 API 稳定，版本升级后行为可能变化
- 不确定自己 DSH 里有没有这个包：`dsh --version` 是 `0.2.2-rc.5` 或更新的 0.2.2.x 一般都带；
  更老版本可能没有，需要升级 DSH
