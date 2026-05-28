import type {
  AccountApiRow,
  BacktestApiRun,
  DailyBar,
  EquityApiPoint,
  RatingApiResponse,
  StockApiRow,
  TaskStatus,
  TradeApiRow,
  PositionApiRow,
  Strategy,
  StreamProgressEvent,
} from '../types'

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? 'http://localhost:8000'

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
  const url = new URL(path, API_BASE_URL)
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
    headers: {
      Accept: 'application/json',
      ...init.headers,
    },
  })

  if (!response.ok) {
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
  getAccounts: () => request<AccountApiRow[]>('/api/accounts'),
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
}
