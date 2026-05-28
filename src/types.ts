export type Strategy = 'short_term' | 'swing' | 'trend' | 'ic_optimized'

export type MarketStatus = 'healthy' | 'warning' | 'danger'

export type TaskPhase = 'pending' | 'running' | 'done' | 'failed'

export interface TaskStatus<T = unknown> {
  task_id: string
  name: string
  status: TaskPhase
  progress: number
  progress_msg?: string
  params?: Record<string, unknown>
  result?: T
  error?: string
  duration_seconds?: number
  from_db?: boolean
}

export interface AccountApiRow {
  account_id: number
  account_name: string
  strategy_name: Strategy
  initial_capital: number
  current_cash: number
  current_equity: number
  return_pct: number
  started_at: string
  is_active: number
}

export interface PositionApiRow {
  ts_code: string
  name?: string | null
  qty: number
  avg_cost: number
  current_price?: number | null
  return_pct?: number | null
  market_value?: number | null
  open_date: string
  price_source?: 'realtime' | 'close' | 'cost' | string | null
}

export interface TradeApiRow {
  trade_id: number
  trade_date: string
  trade_time?: string | null
  side: 'BUY' | 'SELL' | string
  ts_code: string
  name?: string | null
  qty: number
  price: number
  amount: number
  commission: number
  reason?: string | null
}

export interface EquityApiPoint {
  trade_date: string
  cash: number
  market_value: number
  total_equity: number
  daily_return?: number | null
}

export interface ScreenApiPick {
  ts_code: string
  name?: string | null
  score: number
  rank_num: number
}

export interface ScreenApiResult {
  strategy: Strategy
  top_n: number
  picks: ScreenApiPick[]
}

export interface RatingApiFactor {
  key: string
  stars?: number | null
  desc: string
}

export interface RatingApiDimension {
  key: string
  label: string
  stars?: number | null
  weight: number
  factors: RatingApiFactor[]
}

export interface RatingApiResponse {
  ts_code: string
  name: string
  asof: string
  strategy: Strategy
  overall_stars?: number | null
  grade: string
  dimensions: RatingApiDimension[]
}

export interface BacktestApiRun {
  run_id: number
  strategy_name: Strategy
  start_date: string
  end_date: string
  ann_return?: number | null
  sharpe?: number | null
  max_drawdown?: number | null
  win_rate?: number | null
  n_periods?: number | null
  note?: string | null
  created_at: string
}

export interface StockApiRow {
  ts_code: string
  symbol: string
  name: string
  industry?: string | null
  list_date?: string | null
  is_active: number
  is_st: number
}

export interface DailyBar {
  trade_date: string
  open?: number | null
  high?: number | null
  low?: number | null
  close?: number | null
  vol?: number | null
  pct_chg?: number | null
}

export interface StreamProgressEvent<T> {
  progress?: number
  msg?: string
  result?: T
  error?: string
  message?: string
}

export interface OverviewMetric {
  label: string
  value: string
  delta: string
  tone: 'positive' | 'negative' | 'neutral'
}

export interface StrategyProfile {
  key: Strategy
  name: string
  horizon: string
  description: string
  weights: Array<{ name: string; value: number }>
  recommendedFor: string
}

export interface StockPick {
  rank: number
  tsCode: string
  name: string
  score: number
  price: number
  changePct: number
  strategy: Strategy
  factors: {
    value: number
    tech: number
    flow: number
    quality: number
    news: number
  }
}

export interface RatingDetail {
  tsCode: string
  name: string
  strategy: Strategy
  asof: string
  totalScore: number
  grade: 'A' | 'B' | 'C' | 'D'
  action: string
  dimensions: Array<{
    name: string
    score: number
    note: string
  }>
  signals: Array<{
    label: string
    value: string
    tone: 'positive' | 'negative' | 'neutral'
  }>
}

export interface PaperAccount {
  id: number
  name: string
  strategy: Strategy
  initialCapital: number
  currentEquity: number
  cash: number
  dailyReturn: number
  totalReturn: number
  maxDrawdown: number
  positionsCount: number
  status: MarketStatus
}

export interface Position {
  tsCode: string
  name: string
  qty: number
  avgCost: number
  price: number
  returnPct: number
  marketValue: number
  openDate: string
}

export interface Trade {
  id: number
  date: string
  accountId: number
  tsCode: string
  name: string
  side: 'BUY' | 'SELL'
  qty: number
  price: number
  reason: string
}

export interface EquityPoint {
  date: string
  equity: number
  benchmark: number
}

export interface BacktestRun {
  id: number
  name: string
  strategy: Strategy
  period: string
  annualReturn: number
  maxDrawdown: number
  sharpe: number
  winRate: number
  alpha: number
}
