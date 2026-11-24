/**
 * dsh-todo-finalizer — host half.
 *
 * The `todos` session projection is cleared by the *next* `turn/start`, so a
 * turn that ends with a last-written checklist containing pending / in_progress
 * items leaves the TodoDock showing "1 已完成 · 2 未完成" long after the
 * conversation is finished. The honest fix is agent discipline (always finish
 * the checklist before answering), but discipline is not a guarantee.
 *
 * This plugin is the guarantee: when a turn ends with reason.kind ===
 * 'completed' and the checklist written *during that turn* still has unfinished
 * items, it appends one `todo/write` snapshot marking every item completed.
 * The panel then matches "the turn is over". Aborted / blocked / error /
 * max-tokens turns are left untouched — their unfinished state is real.
 *
 * The append is deferred with queueMicrotask: doing it inside the turn/end
 * dispatch would re-enter the session log while the emitter is still walking
 * its listeners. Every failure is swallowed: bookkeeping must never break a
 * turn.
 */

const TODO_EVENT = 'todo/write'

/** @type {Map<object, {turn: number | null, todos: unknown, todoTurn: number | null, finalizedTurn: number | null, stops: Set<() => void>}>} */
const records = new Map()

function isTodoArray(value) {
  return Array.isArray(value) && value.length > 0
}

function allCompleted(todos) {
  return todos.every(item => item !== null && typeof item === 'object' && item.status === 'completed')
}

function finalizedSnapshot(todos) {
  return todos.map(item => ({
    content: typeof item?.content === 'string' ? item.content : '',
    status: 'completed',
  }))
}

function recordOf(agent, create) {
  let record = records.get(agent)
  if (record === undefined && create === true) {
    record = { turn: null, todos: null, todoTurn: null, finalizedTurn: null, stops: new Set() }
    records.set(agent, record)
  }
  return record
}

function disposeAgent(agent) {
  const record = records.get(agent)
  if (record === undefined) return
  records.delete(agent)
  for (const stop of record.stops) {
    try { stop() } catch (error) { /* Ignore a broken agent teardown. */ }
  }
  record.stops.clear()
}

function attach(ctx, agent) {
  let record
  try {
    record = recordOf(agent, true)
  } catch (error) {
    return
  }
  if (record === undefined) return

  const onSessionEvent = (session, event) => {
    try {
      if (event === null || typeof event !== 'object') return
      if (event.type === 'turn/start') {
        record.turn = typeof event.data?.turn === 'number' ? event.data.turn : null
        return
      }
      if (event.type === TODO_EVENT) {
        if (isTodoArray(event.data?.todos)) {
          record.todos = event.data.todos
          record.todoTurn = record.turn
        }
        return
      }
      if (event.type !== 'turn/end') return
      const reason = event.data?.reason
      if (reason === null || typeof reason !== 'object' || reason.kind !== 'completed') return
      const turn = typeof event.data?.turn === 'number' ? event.data.turn : null
      if (!isTodoArray(record.todos)) return
      if (record.todoTurn !== turn) return
      if (record.finalizedTurn === turn) return
      if (allCompleted(record.todos)) return
      const todos = record.todos
      const finalized = finalizedSnapshot(todos)
      record.finalizedTurn = turn
      // Defer out of the event dispatch; re-check that this turn is still the
      // agent's current turn and the session is still alive before writing.
      queueMicrotask(() => {
        try {
          if (record.turn !== turn) return
          session.append(TODO_EVENT, { todos: finalized })
          record.todos = finalized
        } catch (error) {
          try { ctx.logger?.warn?.('[todo-finalizer] append failed', error) } catch (inner) { /* Ignore. */ }
        }
      })
    } catch (error) {
      // Never let bookkeeping break the host.
    }
  }

  let stop
  try {
    stop = agent.ctx?.on?.('session/event', onSessionEvent)
  } catch (error) {
    stop = undefined
  }
  if (typeof stop === 'function') record.stops.add(stop)
  return () => disposeAgent(agent)
}

export function apply(ctx) {
  const dispose = () => {
    for (const agent of Array.from(records.keys())) disposeAgent(agent)
  }
  try {
    ctx.effect(() => {
      const off = ctx.on('agent/created', payload => {
        try {
          const agent = payload?.agent
          if (agent !== null && typeof agent === 'object') attach(ctx, agent)
        } catch (error) { /* Ignore one broken agent. */ }
      })
      return () => {
        try { if (typeof off === 'function') off() } catch (error) { /* Ignore. */ }
        dispose()
      }
    }, 'todo-finalizer: agents')
  } catch (error) {
    // Host without the agent-created seam: stay inert.
    dispose()
  }
}
