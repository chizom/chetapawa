import { randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import type { CreatorRow, GoalProgressRow, GoalRow, TipRow } from '~~/types/db'

// Local fallback database, used when Supabase keys are not set.
// It implements only the small part of the supabase-js query builder this app uses
// (select, insert, update, eq, in, gte, is, order, limit, single, maybeSingle), so the
// API routes run unchanged on either backend. Data is kept in memory and saved to
// .data/local-db.json (git-ignored) so it survives dev server restarts.
// It mirrors the Postgres rules that matter: unique handles, one active goal per
// creator (error code 23505, like Postgres), column defaults, and the cz_goal_progress view.

type Row = Record<string, unknown>
type TableName = 'cz_creators' | 'cz_goals' | 'cz_tips'
type DbError = { message: string; code?: string }
type Result = { data: unknown; error: DbError | null }

interface Store {
  cz_creators: CreatorRow[]
  cz_goals: GoalRow[]
  cz_tips: TipRow[]
}

const FILE = resolve(process.cwd(), '.data', 'local-db.json')

let store: Store | null = null

function load(): Store {
  if (store) return store
  store = { cz_creators: [], cz_goals: [], cz_tips: [] }
  try {
    if (existsSync(FILE)) {
      const parsed = JSON.parse(readFileSync(FILE, 'utf8')) as Partial<Store>
      store.cz_creators = parsed.cz_creators ?? []
      store.cz_goals = parsed.cz_goals ?? []
      store.cz_tips = parsed.cz_tips ?? []
    }
  } catch (err) {
    console.error('[local-db] Could not read', FILE, '- starting empty.', err instanceof Error ? err.message : err)
  }
  return store
}

function save(): void {
  if (!store) return
  try {
    mkdirSync(dirname(FILE), { recursive: true })
    const tmp = `${FILE}.tmp`
    writeFileSync(tmp, JSON.stringify(store, null, 2))
    renameSync(tmp, FILE)
  } catch (err) {
    // Read-only filesystems (some hosts) still work, the data just lives in memory.
    console.error('[local-db] Could not save', FILE, err instanceof Error ? err.message : err)
  }
}

function now(): string {
  return new Date().toISOString()
}

const DEFAULTS: Record<TableName, () => Row> = {
  cz_creators: () => ({ id: randomUUID(), bio: null, created_at: now() }),
  cz_goals: () => ({ id: randomUUID(), active: true, created_at: now(), completed_at: null }),
  cz_tips: () => ({
    id: randomUUID(),
    goal_id: null,
    amount_in_formatted: null,
    amount_out: null,
    amount_out_formatted: null,
    amount_out_usd: null,
    quote_out_usd: null,
    expires_at: null,
    deposit_memo: null,
    status: 'pending',
    tipper_name: null,
    message: null,
    created_at: now(),
    settled_at: null
  })
}

/** Unique constraints, checked on insert and update. Returns an error message when broken. */
function uniqueViolation(table: TableName, rows: Row[], candidate: Row): string | null {
  if (table === 'cz_creators') {
    if (rows.some((r) => r !== candidate && r.handle === candidate.handle)) return 'duplicate key: cz_creators_handle_key'
  }
  if (table === 'cz_goals' && candidate.active === true) {
    if (rows.some((r) => r !== candidate && r.active === true && r.creator_id === candidate.creator_id)) {
      return 'duplicate key: cz_goals_one_active_per_creator'
    }
  }
  return null
}

/** Same columns and math as the cz_goal_progress view in supabase/schema.sql. */
function goalProgressRows(s: Store): GoalProgressRow[] {
  return s.cz_goals.map((g) => {
    const tips = s.cz_tips.filter((t) => t.goal_id === g.id && t.status === 'success')
    return {
      goal_id: g.id,
      creator_id: g.creator_id,
      title: g.title,
      target_amount: g.target_amount,
      active: g.active,
      created_at: g.created_at,
      completed_at: g.completed_at,
      raised_usd: tips.reduce((sum, t) => sum + (Number(t.amount_out_usd) || 0), 0),
      raised_out: tips.reduce((sum, t) => sum + (Number(t.amount_out) || 0), 0),
      tip_count: tips.length
    } as GoalProgressRow
  })
}

function compare(a: unknown, b: unknown): number {
  if (a === b) return 0
  if (a === null || a === undefined) return 1 // Postgres puts nulls last in ascending order
  if (b === null || b === undefined) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a) < String(b) ? -1 : 1
}

function project(row: Row, cols: string): Row {
  const names = cols.split(',').map((c) => c.trim()).filter(Boolean)
  if (names.length === 0 || names.includes('*')) return { ...row }
  const out: Row = {}
  for (const n of names) out[n] = row[n] ?? null
  return out
}

class LocalQuery implements PromiseLike<Result> {
  private op: 'select' | 'insert' | 'update' = 'select'
  private cols = '*'
  private returning = false
  private payload: Row = {}
  private filters: Array<(r: Row) => boolean> = []
  private orders: Array<{ col: string; asc: boolean }> = []
  private max: number | null = null
  private mode: 'many' | 'single' | 'maybe' = 'many'

  constructor(private readonly table: string) {}

  select(cols = '*'): this {
    if (this.op === 'select') this.cols = cols
    else {
      this.returning = true
      this.cols = cols
    }
    return this
  }

  insert(values: Row): this {
    this.op = 'insert'
    this.payload = values
    return this
  }

  update(values: Row): this {
    this.op = 'update'
    this.payload = values
    return this
  }

  eq(col: string, value: unknown): this {
    this.filters.push((r) => r[col] === value)
    return this
  }

  in(col: string, values: unknown[]): this {
    this.filters.push((r) => values.includes(r[col]))
    return this
  }

  gte(col: string, value: unknown): this {
    this.filters.push((r) => r[col] !== null && r[col] !== undefined && compare(r[col], value) >= 0)
    return this
  }

  is(col: string, value: null): this {
    this.filters.push((r) => (r[col] ?? null) === value)
    return this
  }

  order(col: string, opts: { ascending?: boolean } = {}): this {
    this.orders.push({ col, asc: opts.ascending !== false })
    return this
  }

  limit(n: number): this {
    this.max = n
    return this
  }

  returns(): this {
    return this
  }

  single(): this {
    this.mode = 'single'
    return this
  }

  maybeSingle(): this {
    this.mode = 'maybe'
    return this
  }

  then<A = Result, B = never>(onOk?: ((v: Result) => A | PromiseLike<A>) | null, onErr?: ((e: unknown) => B | PromiseLike<B>) | null): PromiseLike<A | B> {
    return Promise.resolve().then(() => this.run()).then(onOk, onErr)
  }

  private run(): Result {
    const s = load()
    let rows: Row[]

    if (this.op === 'insert') {
      if (!isTable(this.table)) return fail(`cannot insert into ${this.table}`)
      const table = s[this.table] as unknown as Row[]
      const row = { ...DEFAULTS[this.table](), ...this.payload }
      const dup = uniqueViolation(this.table, table, row)
      if (dup) return fail(dup, '23505')
      table.push(row)
      save()
      rows = [row]
      if (!this.returning) return { data: null, error: null }
    } else if (this.op === 'update') {
      if (!isTable(this.table)) return fail(`cannot update ${this.table}`)
      const table = s[this.table] as unknown as Row[]
      const matched = table.filter((r) => this.filters.every((f) => f(r)))
      for (const r of matched) {
        const next = { ...r, ...this.payload }
        const dup = uniqueViolation(this.table, table.filter((x) => x !== r), next)
        if (dup) return fail(dup, '23505')
      }
      for (const r of matched) Object.assign(r, this.payload)
      if (matched.length > 0) save()
      rows = matched
      if (!this.returning) return { data: null, error: null }
    } else {
      let source: Row[]
      if (this.table === 'cz_goal_progress') source = goalProgressRows(s) as unknown as Row[]
      else if (isTable(this.table)) source = s[this.table] as unknown as Row[]
      else return fail(`unknown table ${this.table}`)
      rows = source.filter((r) => this.filters.every((f) => f(r)))
      for (const o of [...this.orders].reverse()) {
        rows = [...rows].sort((a, b) => (o.asc ? 1 : -1) * compare(a[o.col], b[o.col]))
      }
      if (this.max !== null) rows = rows.slice(0, this.max)
    }

    const out = rows.map((r) => project(r, this.cols))
    if (this.mode === 'many') return { data: out, error: null }
    if (out.length > 1) return fail('more than one row returned', 'PGRST116')
    if (out.length === 0) return this.mode === 'maybe' ? { data: null, error: null } : fail('no rows returned', 'PGRST116')
    return { data: out[0], error: null }
  }
}

function isTable(name: string): name is TableName {
  return name === 'cz_creators' || name === 'cz_goals' || name === 'cz_tips'
}

function fail(message: string, code?: string): Result {
  return { data: null, error: { message, code } }
}

export function createLocalDb(): { from: (table: string) => LocalQuery } {
  return { from: (table: string) => new LocalQuery(table) }
}

export const LOCAL_DB_FILE = FILE
