// Pure-Node unit test for dsh-todo-finalizer's host half.
//
// Exercises the event wiring against fake cordis Context / Agent / Session
// objects — no DSH process, no browser:
//   1. a completed turn whose last checklist has unfinished items gets one
//      deferred todo/write with every item completed;
//   2. aborted turns are left alone;
//   3. an already-complete checklist is left alone;
//   4. a checklist written in an earlier turn is not finalized;
//   5. duplicate turn/end for the same turn appends at most once.
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const source = readFileSync(new URL('../src/index.js', import.meta.url), 'utf8')
const module = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)

function makeHarness() {
  const created = []
  const ctx = {
    logger: { warn() {} },
    on(name, fn) {
      if (name === 'agent/created') created.push(fn)
      return () => {}
    },
    effect(fn) { const disposer = fn(); return typeof disposer === 'function' ? disposer : () => {} },
  }
  const agent = {
    ctx: {
      on(name, fn) {
        if (name === 'session/event') this.handler = fn
        return () => { this.handler = null }
      },
    },
  }
  const session = {
    appended: [],
    append(type, data) { this.appended.push({ type, data }) },
  }
  const emitAgent = () => { for (const fn of created) fn({ agent }) }
  const emitEvent = (type, data) => agent.ctx.handler(session, { type, data })
  return { ctx, agent, session, emitAgent, emitEvent }
}

const tick = () => new Promise(resolve => setTimeout(resolve, 0))

const results = {}
try {
  module.apply(makeHarness().ctx)

  {
    const { ctx, session, emitAgent, emitEvent } = makeHarness()
    module.apply(ctx)
    emitAgent()
    emitEvent('turn/start', { turn: 1 })
    emitEvent('todo/write', { todos: [
      { content: 'A', status: 'completed' },
      { content: 'B', status: 'in_progress' },
      { content: 'C', status: 'pending' },
    ] })
    emitEvent('turn/end', { turn: 1, reason: { kind: 'completed' } })
    await tick()
    results.completedTurnAppends = session.appended.length === 1
      && session.appended[0].type === 'todo/write'
      && session.appended[0].data.todos.length === 3
      && session.appended[0].data.todos.every(item => item.status === 'completed')
  }

  {
    const { ctx, session, emitAgent, emitEvent } = makeHarness()
    module.apply(ctx)
    emitAgent()
    emitEvent('turn/start', { turn: 2 })
    emitEvent('todo/write', { todos: [{ content: 'A', status: 'in_progress' }] })
    emitEvent('turn/end', { turn: 2, reason: { kind: 'aborted', reason: { kind: 'user' } } })
    await tick()
    results.abortedTurnUntouched = session.appended.length === 0
  }

  {
    const { ctx, session, emitAgent, emitEvent } = makeHarness()
    module.apply(ctx)
    emitAgent()
    emitEvent('turn/start', { turn: 3 })
    emitEvent('todo/write', { todos: [{ content: 'A', status: 'completed' }] })
    emitEvent('turn/end', { turn: 3, reason: { kind: 'completed' } })
    await tick()
    results.alreadyDoneUntouched = session.appended.length === 0
  }

  {
    const { ctx, session, emitAgent, emitEvent } = makeHarness()
    module.apply(ctx)
    emitAgent()
    emitEvent('turn/start', { turn: 4 })
    emitEvent('todo/write', { todos: [{ content: 'A', status: 'pending' }] })
    emitEvent('turn/start', { turn: 5 })
    emitEvent('turn/end', { turn: 5, reason: { kind: 'completed' } })
    await tick()
    results.previousTurnChecklistUntouched = session.appended.length === 0
  }

  {
    const { ctx, session, emitAgent, emitEvent } = makeHarness()
    module.apply(ctx)
    emitAgent()
    emitEvent('turn/start', { turn: 6 })
    emitEvent('todo/write', { todos: [{ content: 'A', status: 'pending' }] })
    emitEvent('turn/end', { turn: 6, reason: { kind: 'completed' } })
    emitEvent('turn/end', { turn: 6, reason: { kind: 'completed' } })
    await tick()
    results.duplicateEndAppendsOnce = session.appended.length === 1
  }
} catch (error) {
  results.error = String(error && error.stack ? error.stack : error)
}

const flags = Object.entries(results).filter(([, value]) => typeof value === 'boolean')
results.ALL_PASS = flags.length > 0 && flags.every(([, value]) => value === true)
console.log(JSON.stringify(results, null, 1))
process.exit(results.ALL_PASS ? 0 : 1)
