import type {
  AccountApiRow,
  AccountHistoryRow,
  AccountStatus,
  AssetType,
  BacktestApiRun,
  DailyBar,
  DeleteAccountResult,
  EquityApiPoint,
  RatingApiResponse,
  StockApiRow,
  TaskStatus,
  TradeApiRow,
  PositionApiRow,
  Strategy,
  StrategyDefinition,
  StreamProgressEvent,
  TaskHistoryRow,
  SystemDataStatus,
  TradeRun,
  TradeRunDetailDashboard,
  TradeRunEvent,
  TradeRunFill,
  TradeRunPerformance,
  TradeRunPlan,
  TradeRunPosition,
  TradeRunsDashboard,
  TradeSide,
  SignalSource,
  PlanWindow,
  TradeRunComparison,
  EtfRow,
  MarketScanTask,
} from '../types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173')
let unauthorizedHandler: (() => void) | undefined

export function onUnauthorized(handler?: () => void) {
  unauthorizedHandler = handler
  return () => { if (unauthorizedHandler === handler) unauthorizedHandler = undefined }
}

export class ApiError extends Error {
  status: number
  code?: string
  detail?: unknown

  constructor(message: string, status: number, code?: string, detail?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.detail = detail
  }
}

export function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined | null>) {
  const url = new URL(path, `${API_BASE_URL.replace(/\/$/, '')}/`)
  Object.entries(params ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.set(key, String(value))
    }
  })
  return url.toString()
}

async function request<T>(
  path: string,
  options?: RequestInit & { params?: Record<string, string | number | boolean | undefined | null> },
): Promise<T> {
  const { params, ...init } = options ?? {}
  const response = await fetch(buildUrl(path, params), {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  })

  if (!response.ok) {
    if (response.status === 401) unauthorizedHandler?.()
    let payload: { error?: string; message?: string; detail?: unknown } | undefined
    try {
      payload = await response.json()
    } catch {
      payload = undefined
    }
    throw new ApiError(
      payload?.message ?? response.statusText ?? '请求失败',
      response.status,
      payload?.error,
      payload?.detail,
    )
  }

  return response.json() as Promise<T>
}

export interface ScreenParams {
  strategy: Strategy
  capital: number
  top: number
  limit: number
  lookback: number
  enableNews: boolean
}

export interface BacktestParams {
  strategy: Strategy
  months: number
  limit: number
  top: number
  capital: number
  rebalWeeks: number
}

export interface DailyRunParams {
  asof?: string
  limit: number
  dryRun: boolean
}

export interface CreateTradeRunParams {
  name: string
  strategyCode: Extract<Strategy, 'short_term' | 'medium_term' | 'long_term'>
  capital: number
  maxPositionPct: number
  assetTypes: AssetType[]
  signalSource: SignalSource
  shadowSignalSource?: SignalSource
  planWindows: PlanWindow[]
}

export interface RecordTradeRunFillParams {
  idempotencyKey: string
  planId?: number
  tsCode: string
  assetType?: AssetType
  side: TradeSide
  qty: number
  price: number
  fee: number
  executedAt: string
  note?: string
  brokerQuoteConfirmed: boolean
  quoteCheckedAt: string
}

export interface MarketScanSubmitParams {
  strategyCode: Extract<Strategy, 'short_term' | 'medium_term' | 'long_term'>
  assetTypes: AssetType[]
  planWindow: PlanWindow
  stockScope: 'quick' | 'full'
  quickLimit?: number
  asOf?: string
}

function toAccountHistory(row: AccountApiRow | AccountHistoryRow): AccountHistoryRow {
  return {
    account_id: row.account_id,
    account_name: row.account_name,
    strategy_name: row.strategy_name,
    initial_capital: row.initial_capital,
    final_equity: row.final_equity ?? null,
    final_return_pct: row.final_return_pct ?? null,
    current_equity: 'current_equity' in row ? row.current_equity : undefined,
    return_pct: 'return_pct' in row ? row.return_pct : undefined,
    started_at: row.started_at,
    ended_at: row.ended_at ?? null,
    days_run: 'days_run' in row ? row.days_run : null,
    note: row.note ?? null,
    is_active: row.is_active,
  }
}

export interface StreamHandlers<T> {
  onProgress?: (progress: number, message: string, event: StreamProgressEvent<T>) => void
  onResult?: (result: T, event: StreamProgressEvent<T>) => void
  onError?: (message: string, event?: StreamProgressEvent<T>) => void
}

function openJsonStream<T>(
  path: string,
  params: Record<string, string | number | boolean | undefined | null>,
  handlers: StreamHandlers<T>,
) {
  const source = new EventSource(buildUrl(path, params))
  let finished = false

  source.onmessage = (event) => {
    let payload: StreamProgressEvent<T>
    try {
      payload = JSON.parse(event.data) as StreamProgressEvent<T>
    } catch {
      handlers.onError?.('流式响应解析失败')
      source.close()
      finished = true
      return
    }

    if (payload.error) {
      handlers.onError?.(payload.message ?? payload.error, payload)
      source.close()
      finished = true
      return
    }

    if (payload.result !== undefined) {
      handlers.onResult?.(payload.result, payload)
      source.close()
      finished = true
      return
    }

    handlers.onProgress?.(Number(payload.progress ?? 0), payload.msg ?? '', payload)
  }

  source.onerror = () => {
    if (finished) return
    handlers.onError?.('流式连接中断')
    source.close()
    finished = true
  }

  return () => {
    source.close()
    finished = true
  }
}

export const api = {
  baseUrl: API_BASE_URL,
  health: () => request<{ status: string; db: string }>('/health'),
  getTradeRunsDashboard: () => request<TradeRunsDashboard>('/api/dashboard'),
  getTradeRuns: (includeDeleted = false) =>
    request<TradeRun[]>('/api/trade-runs', { params: { include_deleted: includeDeleted } }),
  getTradeRun: (runId: number) => request<TradeRun>(`/api/trade-runs/${runId}`),
  createTradeRun: (params: CreateTradeRunParams) =>
    request<TradeRun>('/api/trade-runs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: params.name,
        strategy_code: params.strategyCode,
        capital: params.capital,
        max_position_pct: params.maxPositionPct,
        asset_types: params.assetTypes,
        signal_source: params.signalSource,
        shadow_signal_source: params.shadowSignalSource,
        plan_windows: params.planWindows,
      }),
    }),
  startTradeRun: (runId: number) => request<TradeRun>(`/api/trade-runs/${runId}/start`, { method: 'POST' }),
  stopTradeRun: (runId: number, action: 'pause' | 'end', reason: string) =>
    request<TradeRun>(`/api/trade-runs/${runId}/stop`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    }),
  deleteTradeRun: (runId: number) => request<TradeRun>(`/api/trade-runs/${runId}`, { method: 'DELETE' }),
  getTradeRunDashboard: (runId: number) => request<TradeRunDetailDashboard>(`/api/trade-runs/${runId}/dashboard`),
  getTradeRunPlans: (runId: number) => request<TradeRunPlan[]>(`/api/trade-runs/${runId}/plans`),
  getTradeRunPositions: (runId: number) => request<TradeRunPosition[]>(`/api/trade-runs/${runId}/positions`),
  getTradeRunPerformance: (runId: number) => request<TradeRunPerformance>(`/api/trade-runs/${runId}/performance`),
  getTradeRunEvents: (runId: number, limit = 50) =>
    request<TradeRunEvent[]>(`/api/trade-runs/${runId}/events`, { params: { limit } }),
  recordTradeRunFill: (runId: number, params: RecordTradeRunFillParams) =>
    request<{ fill: TradeRunFill; idempotent: boolean }>(`/api/trade-runs/${runId}/fills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idempotency_key: params.idempotencyKey,
        plan_id: params.planId,
        ts_code: params.tsCode,
        asset_type: params.assetType,
        side: params.side,
        qty: params.qty,
        price: params.price,
        fee: params.fee,
        executed_at: params.executedAt,
        source: 'manual',
        note: params.note,
        broker_quote_confirmed: params.brokerQuoteConfirmed,
        quote_checked_at: params.quoteCheckedAt,
      }),
    }),
  generateTradeRunPlans: (runId: number, planWindow: PlanWindow, asOf?: string) =>
    request<TradeRunPlan[] | { plans?: TradeRunPlan[]; [key: string]: unknown }>(`/api/trade-runs/${runId}/generate-plans`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan_window: planWindow, as_of: asOf }),
    }),
  submitMarketScan: (params: MarketScanSubmitParams) =>
    request<{ task_id: string; status: string; task: MarketScanTask; tip: string }>('/api/market-scans', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ strategy_code: params.strategyCode, asset_types: params.assetTypes, plan_window: params.planWindow, stock_scope: params.stockScope, quick_limit: params.quickLimit, as_of: params.asOf }),
    }),
  getMarketScanTasks: (limit = 30) =>
    request<MarketScanTask[]>('/api/market-scans', { params: { limit } }),
  getMarketScanTask: (taskId: string) =>
    request<MarketScanTask>(`/api/market-scans/${encodeURIComponent(taskId)}`),
  getTradeRunComparison: (runId: number) => request<TradeRunComparison>(`/api/trade-runs/${runId}/comparison`),
  getTradeRunStrategyDefinitions: () => request<StrategyDefinition[]>('/api/trade-runs/strategy-definitions'),
  getSystemDataStatus: () => request<SystemDataStatus>('/api/system/data-status'),
  getEtfs: (params?: { search?: string; etfType?: string; whitelistOnly?: boolean; limit?: number }) =>
    request<EtfRow[]>('/api/etfs', { params: { search: params?.search, etf_type: params?.etfType, whitelist_only: params?.whitelistOnly ?? true, limit: params?.limit ?? 100 } }),
  login: (username: string, password: string) => request<{ authenticated: boolean; expires_at: number }>('/api/auth/session', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) }),
  getSession: () => request<{ authenticated: boolean; expires_at: number | null }>('/api/auth/session'),
  logout: () => request<{ authenticated: boolean }>('/api/auth/session', { method: 'DELETE' }),
  getStrategies: () => request<{ strategies: Strategy[] }>('/api/screen/strategies'),
  getOptimalTopN: (capital: number) =>
    request<{ capital: number; top_n: number }>('/api/screen/optimal-top-n', { params: { capital } }),
  runScreenAsync: (params: ScreenParams) =>
    request<{ task_id: string; status: string; tip: string }>('/api/screen/async', {
      method: 'POST',
      params: {
        strategy: params.strategy,
        capital: params.capital,
        top: params.top,
        limit: params.limit,
        lookback: params.lookback,
        enable_news: params.enableNews,
      },
    }),
  getRating: (code: string, strategy: Strategy, noFlow = false, noNews = false) =>
    request<RatingApiResponse>(`/api/rate/${encodeURIComponent(code)}`, {
      params: { strategy, no_flow: noFlow, no_news: noNews },
    }),
  streamRating: (
    code: string,
    params: { strategy: Strategy; noFlow?: boolean; noNews?: boolean },
    handlers: StreamHandlers<RatingApiResponse>,
  ) =>
    openJsonStream<RatingApiResponse>(
      `/api/rate/${encodeURIComponent(code)}/stream`,
      { strategy: params.strategy, no_flow: params.noFlow ?? false, no_news: params.noNews ?? false },
      handlers,
    ),
  searchStocks: (search: string, limit = 20) =>
    request<StockApiRow[]>('/api/stocks', { params: { search, limit } }),
  getDailyBars: (tsCode: string, limit = 90) =>
    request<DailyBar[]>(`/api/stocks/${encodeURIComponent(tsCode)}/daily`, { params: { limit } }),
  getAccounts: (status: AccountStatus = 'active') =>
    request<AccountApiRow[]>('/api/accounts', { params: { status } }),
  getAccount: (accountId: number) => request<AccountApiRow>(`/api/accounts/${accountId}`),
  getAccountHistory: async () => {
    try {
      return await request<AccountHistoryRow[]>('/api/accounts/history')
    } catch (err) {
      if (!(err instanceof ApiError) || (err.status !== 404 && err.status !== 422)) throw err
      const accounts = await request<AccountApiRow[]>('/api/accounts', { params: { status: 'all' } })
      return accounts.filter((account) => !account.is_active).map(toAccountHistory)
    }
  },
  createAccount: (name: string, capital: number, strategy: Strategy) =>
    request<{ account_id: number; name: string; capital: number; strategy: Strategy }>('/api/accounts', {
      method: 'POST',
      params: { name, capital, strategy },
    }),
  getPositions: (accountId: number, useRealtime = true, asof?: string) =>
    request<PositionApiRow[]>(`/api/accounts/${accountId}/positions`, {
      params: { use_realtime: useRealtime, asof },
    }),
  streamPositions: (
    accountId: number,
    params: { asof?: string; useRealtime?: boolean },
    handlers: StreamHandlers<PositionApiRow[]>,
  ) =>
    openJsonStream<PositionApiRow[]>(
      `/api/accounts/${accountId}/positions/stream`,
      { asof: params.asof, use_realtime: params.useRealtime ?? true },
      handlers,
    ),
  getTrades: (accountId: number, limit = 50) =>
    request<TradeApiRow[]>(`/api/accounts/${accountId}/trades`, { params: { limit } }),
  getEquityCurve: (accountId: number) => request<EquityApiPoint[]>(`/api/accounts/${accountId}/equity`),
  getReport: (accountId: number, asof?: string) =>
    request<{ report: string }>(`/api/accounts/${accountId}/report`, { params: { asof } }),
  saveSnapshot: (accountId: number, asof?: string) =>
    request<{ total_equity: number }>(`/api/accounts/${accountId}/snapshot`, {
      method: 'POST',
      params: { asof },
    }),
  triggerStoploss: (accountId: number, asof?: string) =>
    request<Record<string, unknown>>(`/api/accounts/${accountId}/stoploss`, {
      method: 'POST',
      params: { asof },
    }),
  runAutoRebalanceAsync: (accountId: number, limit: number, enableNews: boolean, asof?: string) =>
    request<{ task_id: string; status: string; tip: string }>(`/api/accounts/${accountId}/auto-rebalance/async`, {
      method: 'POST',
      params: { limit, enable_news: enableNews, asof },
    }),
  runDailyAsync: (accountId: number, params: DailyRunParams) =>
    request<{ task_id: string; status: string; tip: string }>(`/api/accounts/${accountId}/daily-run/async`, {
      method: 'POST',
      params: { limit: params.limit, dry_run: params.dryRun, asof: params.asof },
    }),
  terminateAccountAsync: (accountId: number, useRealtime = true) =>
    request<{ task_id: string; status: string; tip: string }>(`/api/accounts/${accountId}/terminate/async`, {
      method: 'POST',
      params: { use_realtime: useRealtime },
    }),
  deleteAccount: (accountId: number) =>
    request<DeleteAccountResult>(`/api/accounts/${accountId}`, {
      method: 'DELETE',
    }),
  getBacktests: (strategy?: Strategy, limit = 50) =>
    request<BacktestApiRun[]>('/api/backtest', { params: { strategy, limit } }),
  runBacktestAsync: (params: BacktestParams) =>
    request<{ task_id: string; status: string; tip: string }>('/api/backtest/run/async', {
      method: 'POST',
      params: {
        strategy: params.strategy,
        months: params.months,
        limit: params.limit,
        top: params.top,
        capital: params.capital,
        rebal_weeks: params.rebalWeeks,
      },
    }),
  getTask: (taskId: string, includeResult = true) =>
    request<TaskStatus>(`/api/tasks/${taskId}`, { params: { include_result: includeResult } }),
  getTasks: (name?: string, status?: string, limit = 30) =>
    request<TaskStatus[]>('/api/tasks', { params: { name, status, limit } }),
  getTaskHistory: (filters?: { name?: string; status?: string; limit?: number }) =>
    request<TaskHistoryRow[]>('/api/tasks/history', {
      params: { name: filters?.name, status: filters?.status, limit: filters?.limit ?? 30 },
    }),
}
