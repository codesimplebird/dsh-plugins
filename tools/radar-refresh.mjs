#!/usr/bin/env node
// Refresh the DSH "optimization projects" increment from dsh-plugin-radar.
//
// Data source (public, no key):
//   https://raw.githubusercontent.com/AdamPlatin123/dsh-plugin-radar/main/data/latest.json
//   https://raw.githubusercontent.com/AdamPlatin123/dsh-plugin-radar/main/data/plugins-all.json
//
// Writes:
//   docs/DSH雷达增量-<YYYYMMDD>.md   (dated snapshot)
//   docs/DSH雷达增量-最新.md         (same content, stable link)
//
// Usage: node tools/radar-refresh.mjs [--min-stars=100] [--dry-run]
// Exit 0 on success. On network/schema failure it exits non-zero WITHOUT
// touching the previous files, so a bad run never clobbers good data.

import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DOCS = join(ROOT, 'docs')
const RAW = 'https://raw.githubusercontent.com/AdamPlatin123/dsh-plugin-radar/main/data'
const UA = { 'user-agent': 'dsh-plugins-radar-refresh' }

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const minStarsArg = args.find((a) => a.startsWith('--min-stars='))
const MIN_STARS = minStarsArg ? Number(minStarsArg.split('=')[1]) : 100

// Most specific groups first: a description often mentions several keywords
// ("任务清单...位置记忆", "token 斗图...市场"), so first-match wins.
const GROUPS = [
  {
    key: '任务 / 待办',
    re: /任务清单|待办|\btodo\b|taskboard|看板|\btask\b/i,
  },
  {
    key: '记忆 / 召回',
    re: /记忆|memory|recall/i,
  },
  {
    key: '成本 / 用量',
    re: /cost|成本|用量|billing|额度|余额|budget|quota|spend|计费/i,
  },
  {
    key: '模型 / 路由',
    re: /模型选择|模型路由|model\s*router|路由|provider|多模型/i,
  },
  {
    key: '生态 / 发现 / 维护',
    re: /市场|market|雷达|radar|awesome|目录|catalog|插件管理|升级/i,
  },
  {
    key: 'UI / 主题 / 终端',
    re: /主题|theme|外观|玻璃|TUI|终端|界面|皮肤|wallpaper|壁纸/i,
  },
  {
    key: '性能 / 执行效率',
    re: /优化|性能|performance|提速|加速|\btps\b|执行时间|低占用|overhead/i,
  },
  {
    key: '上下文 / Token 效率',
    re: /token|context|上下文|压缩|compact|prune|缓存|cache|\bACP\b|上下文工程/i,
  },
]

async function fetchJson(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(45_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return await res.json()
  } catch (error) {
    if (attempt >= 3) throw new Error(`${url}: ${error.message}`)
    await new Promise((r) => setTimeout(r, attempt * 2_000))
    return fetchJson(url, attempt + 1)
  }
}

function existingRepos() {
  const seen = new Set()
  for (const name of readdirSync(DOCS)) {
    if (!name.endsWith('.md')) continue
    // Never treat our own generation output as the "old list", otherwise a
    // second run would erase every candidate it just found.
    if (name.startsWith('DSH雷达增量')) continue
    const text = readFileSync(join(DOCS, name), 'utf8')
    for (const m of text.matchAll(/github\.com\/([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)/g)) {
      seen.add(m[1].toLowerCase())
    }
    for (const m of text.matchAll(/\[([A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+)\]/g)) {
      seen.add(m[1].toLowerCase())
    }
  }
  return seen
}

function classify(desc) {
  for (const group of GROUPS) if (group.re.test(desc)) return group.key
  return '其他'
}

/** Radar also indexes unrelated agent tooling; keep only DSH/DeepSeek-Harness entries. */
function isDshRelated(repo, desc) {
  const name = String(repo || '').toLowerCase()
  const text = String(desc || '')
  if (name.includes('dsh')) return true
  if (/deepseek[\s-]*harness/i.test(text)) return true
  if (/(^|[^a-z0-9])dsh([^a-z0-9]|$)/i.test(text)) return true
  return false
}

function cell(text, limit = 150) {
  const clean = String(text || '').replace(/\s+/g, ' ').replace(/\|/g, '／').trim()
  return clean.length > limit ? clean.slice(0, limit - 1) + '…' : clean
}

function stamp(date) {
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}`
}

async function main() {
  const [latest, all] = await Promise.all([
    fetchJson(`${RAW}/latest.json`),
    fetchJson(`${RAW}/plugins-all.json`),
  ])
  if (latest?.schema !== 'dsh-radar/v1' || !Array.isArray(all?.plugins)) {
    throw new Error('unexpected radar schema (expected dsh-radar/v1 + plugins[])')
  }

  const known = existingRepos()
  const ok = all.plugins.filter((p) => p && p.verdict === 'ok')
  const candidates = ok
    .filter((p) => p.stars >= MIN_STARS)
    .filter((p) => !known.has(String(p.repo).toLowerCase()))
    .filter((p) => isDshRelated(p.repo, p.desc))
    .map((p) => ({ ...p, group: classify(String(p.desc || '')) }))
    .filter((p) => p.group !== '其他')
    .sort((a, b) => b.stars - a.stars)

  const groups = new Map()
  for (const item of candidates) {
    if (!groups.has(item.group)) groups.set(item.group, [])
    const list = groups.get(item.group)
    if (list.length < 15) list.push(item)
  }

  const now = new Date()
  const day = stamp(now)
  const generated = String(latest.generated_at || '')
  const lines = []
  lines.push(`# DSH 优化项目雷达增量（${day}）`)
  lines.push('')
  lines.push('> 由 `tools/radar-refresh.mjs` 从 [dsh-plugin-radar](https://github.com/AdamPlatin123/dsh-plugin-radar) 自动生成，**勿手改**。')
  lines.push(`> 数据时间：\`${generated}\` · 快照：\`${latest.snapshot_run_id}\``)
  lines.push(`> 雷达统计：可用 ${latest.stats?.ok ?? '?'} · 不兼容 ${latest.stats?.incompatible ?? '?'} · 待定 ${latest.stats?.pending ?? '?'} · 全量 ${latest.total_listed ?? '?'}`)
  lines.push('')
  lines.push(`筛选：verdict = ok，★ ≥ ${MIN_STARS}，描述命中优化类关键词，且**不在**本仓库旧清单（docs/*.md）里；只保留 DSH / DeepSeek Harness 相关项目。`)
  lines.push('')
  if (candidates.length === 0) {
    lines.push('_本次没有发现新的优化类项目。_')
  }
  for (const group of GROUPS) {
    const list = groups.get(group.key)
    if (!list?.length) continue
    lines.push(`## ${group.key}（${list.length}）`)
    lines.push('')
    lines.push('| 项目 | ★ | 说明 |')
    lines.push('|---|---:|---|')
    for (const item of list) {
      lines.push(`| [${item.repo}](https://github.com/${item.repo}) | ${item.stars} | ${cell(item.desc)} |`)
    }
    lines.push('')
  }
  lines.push('---')
  lines.push('')
  lines.push('刷新方式：`node tools/radar-refresh.mjs`（可加 `--min-stars=200`；定时任务每周一 09:30 自动跑）。')
  lines.push('')

  const markdown = lines.join('\n')
  if (dryRun) {
    console.log(markdown)
    console.log(`\n[dry-run] candidates=${candidates.length}`)
    return
  }
  mkdirSync(DOCS, { recursive: true })
  const dated = join(DOCS, `DSH雷达增量-${day}.md`)
  writeFileSync(dated, markdown, 'utf8')
  writeFileSync(join(DOCS, 'DSH雷达增量-最新.md'), markdown, 'utf8')
  console.log(`wrote ${dated}`)
  console.log(`wrote ${join(DOCS, 'DSH雷达增量-最新.md')}`)
  console.log(`candidates=${candidates.length} groups=${[...groups.keys()].join(' | ')}`)
}

main().catch((error) => {
  console.error('radar-refresh failed:', error.message)
  process.exit(1)
})
