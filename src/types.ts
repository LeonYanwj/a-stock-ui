// `swing`、`trend`、`ic_optimized` 仅用于仍保留的旧研究/回测接口。
// 新交易实例接口使用 short_term、medium_term、long_term。
export type Strategy = 'short_term' | 'medium_term' | 'long_term' | 'swing' | 'trend' | 'ic_optimized'

export type TradeRunStatus = 'draft' | 'running' | 'paused' | 'ended' | 'deleted'
export type TradeSide = 'buy' | 'sell'
export type AssetType = 'stock' | 'etf'
export type PlanStatus = 'generated' | 'eligible' | 'blocked' | 'partially_filled' | 'triggered' | 'expired' | 'cancelled'

export type AccountStatus = 'active' | 'terminated' | 'all'

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
  created_at?: string
  started_at?: string | null
  finished_at?: string | null
  progress_events?: Array<{ progress: number; message: string; at?: string }>
}

export interface AccountApiRow {
  account_id: number
  account_name: string
  strategy_name: Strategy
  strategy_id?: number
  initial_capital: number
  current_cash: number
  current_equity: number
  return_pct: number
  started_at: string
  is_active: number
  note?: string | null
  ended_at?: string | null
  final_equity?: number | null
  final_return_pct?: number | null
  rebal_weeks?: number | null
}

export interface AccountHistoryRow {
  account_id: number
  account_name: string
  strategy_name: Strategy
  initial_capital: number
  final_equity?: number | null
  final_return_pct?: number | null
  current_equity?: number | null
  return_pct?: number | null
  started_at: string
  ended_at?: string | null
  days_run?: number | null
  note?: string | null
  is_active?: number
}

export interface TerminateAccountResult {
  account_id: number
  ended_at?: string
  n_sold?: number
  total_revenue?: number
  skipped?: Array<{ ts_code?: string; reason?: string }>
  final_cash?: number
  remaining_market_value?: number
  final_equity?: number
  initial_capital?: number
  final_return_pct?: number
}

export interface DeleteAccountResult {
  ok: boolean
  deleted: number
  removed?: Record<string, number>
  message?: string
}

export interface TaskHistoryRow extends Omit<TaskStatus, 'progress'> {
  progress?: number
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

export interface StrategyDefinition {
  code: Extract<Strategy, 'short_term' | 'medium_term' | 'long_term'>
  name: string
  description: string
  version_id: number
  version_no: number
  algorithm_fingerprint: string
}

export interface TradeRun {
  run_id: number
  name: string
  strategy_code: Extract<Strategy, 'short_term' | 'medium_term' | 'long_term'>
  strategy_version_id: number
  status: TradeRunStatus
  initial_capital: number
  current_cash: number
  max_position_pct: number
  asset_types: AssetType[]
  primary_signal_source?: SignalSource
  shadow_signal_source?: SignalSource
  plan_windows?: PlanWindow[]
  frozen_config: Record<string, unknown>
  created_at: string
  started_at?: string | null
  paused_at?: string | null
  ended_at?: string | null
  deleted_at?: string | null
}

export type SignalSource = 'legacy' | 'new'
export type PlanWindow = 'pre_market' | 'midday'
export type StockScanScope = 'quick' | 'full'

export interface TradeRunsDashboard {
  runs: TradeRun[]
  summary: { total_runs: number; running_runs: number }
}

export interface TradeRunPlan {
  plan_id: number
  run_id: number
  ts_code: string
  asset_type: AssetType
  side: TradeSide
  suggested_qty: number
  reference_price: number
  min_price?: number | null
  max_price?: number | null
  status: PlanStatus
  data_status: string
  blocked_reason?: string | null
  valid_from?: string | null
  expires_at?: string | null
  filled_qty: number
  reason: string
  evidence: Record<string, unknown>
  created_at: string
  signal_source?: SignalSource
  plan_window?: PlanWindow | 'manual'
  execution_confirmation_required?: boolean
  as_of?: string | null
}

export interface MarketScanCandidate {
  ts_code: string
  asset_type: AssetType
  side: TradeSide
  signal_source?: SignalSource
  candidate_status: 'eligible' | 'blocked'
  blocked_reason?: string | null
  reference_price?: number | null
  suggested_price_range?: { min_price?: number | null; max_price?: number | null } | null
  score?: number | null
  reason: string
  data_status: string
  data_source?: string
  data_as_of?: string | null
  execution_confirmation_required?: boolean
  evidence: Record<string, unknown>
}

export interface MarketScanResult {
  plan_window: PlanWindow
  as_of: string
  strategy_code: Extract<Strategy, 'short_term' | 'medium_term' | 'long_term'>
  asset_types: AssetType[]
  stock_scope?: StockScanScope | null
  quick_limit?: number | null
  trading_mode: 'manual_fill'
  quote_reliability: 'not_realtime'
  message: string
  candidates: MarketScanCandidate[]
  candidate_count: number
}

export interface MarketScanTask extends Omit<TaskStatus<MarketScanResult>, 'name' | 'params' | 'error'> {
  name: 'market_scan'
  params?: {
    task_type: 'market_scan'
    strategy_code: Extract<Strategy, 'short_term' | 'medium_term' | 'long_term'>
    asset_types: AssetType[]
    plan_window: PlanWindow
    stock_scope?: StockScanScope | null
    quick_limit?: number | null
    as_of: string
  }
  error?: string | null
}

export interface TradeRunPosition {
  run_id: number
  ts_code: string
  asset_type: AssetType
  qty: number
  sellable_qty: number
  avg_cost: number
  realized_pnl: number
  open_date: string
  updated_at: string
}

export interface TradeRunEvent {
  event_id: number
  run_id: number
  event_type: string
  message: string
  payload: Record<string, unknown>
  created_at: string
}

export interface TradeRunDetailDashboard {
  run: TradeRun
  cash: number
  market_value: number
  market_value_source: string
  total_equity: number
  return_pct: number
  positions: TradeRunPosition[]
  plan_counts: Partial<Record<PlanStatus, number>>
  fill_count: number
  recent_events: TradeRunEvent[]
}

export interface TradeRunPerformance {
  run_id: number
  initial_capital: number
  total_equity: number
  return_pct: number
  realized_pnl: number
  valuation_status: string
  warning?: string
}

export interface SystemDataStatus {
  trading_mode: string
  broker_order_submission: boolean
  data_provider_state: string
  quote_reliability: string
  message: string
}

export interface TradeRunFill {
  fill_id: number
  run_id: number
  plan_id?: number | null
  idempotency_key: string
  ts_code: string
  side: TradeSide
  qty: number
  price: number
  fee: number
  executed_at: string
  source: 'manual'
  note?: string | null
  created_at: string
  broker_quote_confirmed?: boolean
  quote_checked_at?: string | null
}

export interface TradeRunComparisonRow {
  comparison_type: 'overlap' | 'primary_only' | 'shadow_only'
  ts_code: string
  asset_type?: AssetType
  side?: TradeSide
  primary_plan_id?: number | null
  shadow_plan_id?: number | null
  created_at?: string
  [key: string]: unknown
}

export interface TradeRunComparison {
  overlap: TradeRunComparisonRow[]
  primary_only: TradeRunComparisonRow[]
  shadow_only: TradeRunComparisonRow[]
}

export interface EtfRow {
  ts_code: string
  symbol: string
  name: string
  etf_type?: string | null
  tracking_index?: string | null
  listing_status?: string | null
  whitelist?: number | boolean
  avg_amount?: number | null
  updated_at?: string | null
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
