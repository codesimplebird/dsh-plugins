# dsh-plugins

Plugins and configuration examples for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (DSH): per-turn model labels, task-time footer, subagent roster, session-level model badge, an automatic todo finalizer, plus copy-paste profile configs and a planner/executor agent preset.

> Compatibility: verified on **DSH 0.2.2-rc.5** (Windows / desktop profile). Each plugin ships its own test script; re-run them after a DSH upgrade.

## Layout

```
plugins/   five self-made DSH plugins (install with `file:`)
extras/    optional agent preset, Windows launcher, credentials template, profile config snippets
docs/      optimization log, project radar lists, stats-panel notes, screenshots
tools/     small helper scripts
```

## Install a plugin

```powershell
dsh plugin --profile desktop add "file:<repo>\plugins\dsh-turn-tps"
# after editing plugin sources
dsh plugin --profile desktop remove dsh-turn-tps
dsh plugin --profile desktop add "file:<repo>\plugins\dsh-turn-tps"
```

Restart DSH afterwards (client plugins load on page refresh after the restart). Each plugin's README documents behaviour, implementation and tests.

## Config snippets

See [extras/profile-examples.md](extras/profile-examples.md): stats tab (`@deepseek-ai/dsh-experimental-client-ui-stats`), FTS5 session search, free web search via `@liustack/modsearch`, disabling the flash-presets plan-mode component, and the planner/executor preset.

## Docs

- [Optimization log](docs/DSH-优化记录-20261020.md) (Chinese): per-round symptom / root cause / change / verification
- [Project radar](docs/DSH雷达增量-最新.md) and [candidate list](docs/DSH可优化项目清单-20261120.md)
- [Stats panel note](docs/DSH统计面板-推荐说明.md)

## License

MIT. Thanks to [`codesimplebird/dsh-all-in-one`](https://github.com/codesimplebird/dsh-all-in-one) for inspiration, `@liustack/modsearch` and `@ychris12138/dsh-usage-stats` for their plugins.
