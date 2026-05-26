import {
  Activity,
  BarChart3,
  BriefcaseBusiness,
  CheckCircle2,
  ChevronDown,
  Gauge,
  LineChart,
  Loader2,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  WalletCards,
  XCircle,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart as ReLineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ApiError, api, type BacktestParams, type DailyRunParams, type ScreenParams } from './lib/api'
import { cnMoney, fixed, signedPct, toneFromNumber } from './lib/format'
import type {
  AccountApiRow,
  BacktestApiRun,
  DailyBar,
  EquityApiPoint,
  PositionApiRow,
  RatingApiResponse,
  ScreenApiPick,
  ScreenApiResult,
  Strategy,
  TaskStatus,
  TradeApiRow,
} from './types'

type View = 'paper' | 'rating' | 'backtest'

interface AutoRebalanceResult {
  asof?: string | null
  sold?: { n?: number; revenue?: number }
  bought?: { n?: number; spent?: number; skipped?: Array<{ ts_code: string; reason: string }> }
  picks?: string[]
  total_equity?: number
  skipped?: boolean
  reason?: string
}

interface DailyRunResult {
  asof?: string
  dry_run?: boolean
  log?: string
}

const navItems: Array<{ key: View; label: string; icon: typeof Gauge }> = [
  { key: 'paper', label: '模拟盘', icon: WalletCards },
  { key: 'rating', label: '持仓评级', icon: Search },
  { key: 'backtest', label: '回测表现', icon: LineChart },
]

const strategyLabels: Record<Strategy, string> = {
  short_term: '短线',
  swing: '波段',
  trend: '趋势',
  ic_optimized: 'IC 优化',
}

const strategyDescriptions: Record<Strategy, string> = {
  short_term: '1-3 天，重资金流、量价齐升、MACD 与短期反转。',
  swing: '1-4 周，综合价值、质量、资金、技术和消息面。',
  trend: '1-3 月，偏长动量和资金持续流入。',
  ic_optimized: '基于多窗口 IC 调权重，偏稳健验证。',
}

function App() {
  const [view, setView] = useState<View>('paper')
  const [strategy, setStrategy] = useState<Strategy>('swing')
  const [strategies, setStrategies] = useState<Strategy[]>(['short_term', 'swing', 'trend', 'ic_optimized'])
  const [health, setHealth] = useState<{ status: string; db: string } | null>(null)
  const [accounts, setAccounts] = useState<AccountApiRow[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [positions, setPositions] = useState<PositionApiRow[]>([])
  const [trades, setTrades] = useState<TradeApiRow[]>([])
  const [equityCurve, setEquityCurve] = useState<EquityApiPoint[]>([])
  const [dailyReport, setDailyReport] = useState('')
  const [backtests, setBacktests] = useState<BacktestApiRun[]>([])
  const [screenResult, setScreenResult] = useState<ScreenApiResult | null>(null)
  const [rating, setRating] = useState<RatingApiResponse | null>(null)
  const [dailyBars, setDailyBars] = useState<DailyBar[]>([])
  const [selectedRatingCode, setSelectedRatingCode] = useState('')
  const [tasks, setTasks] = useState<TaskStatus[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  const selectedAccount = useMemo(
    () => accounts.find((account) => account.account_id === selectedAccountId) ?? accounts[0],
    [accounts, selectedAccountId],
  )

  async function refreshBase() {
    setLoading(true)
    setError('')
    try {
      const [healthData, strategyData, accountData, backtestData, taskData] = await Promise.all([
        api.health(),
        api.getStrategies(),
        api.getAccounts(),
        api.getBacktests(undefined, 30),
        api.getTasks(undefined, undefined, 12),
      ])
      setHealth(healthData)
      setStrategies(strategyData.strategies)
      setAccounts(accountData)
      setBacktests(backtestData)
      setTasks(taskData)
      if (accountData.length && selectedAccountId === null) {
        setSelectedAccountId(accountData[0].account_id)
        setStrategy(accountData[0].strategy_name)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function refreshAccount(accountId: number) {
    const [positionData, tradeData, curveData, reportData] = await Promise.all([
      api.getPositions(accountId, true),
      api.getTrades(accountId, 50),
      api.getEquityCurve(accountId),
      api.getReport(accountId).catch(() => ({ report: '' })),
    ])
    setPositions(positionData)
    setTrades(tradeData)
    setEquityCurve(curveData)
    setDailyReport(reportData.report)
  }

  async function runRating(code: string, ratingStrategy = strategy, noFlow = false, noNews = false) {
    const normalized = code.trim()
    if (!normalized) return
    setError('')
    setSelectedRatingCode(normalized)
    try {
      const [ratingData, barsData] = await Promise.all([
        api.getRating(normalized, ratingStrategy, noFlow, noNews),
        api.getDailyBars(normalized, 90).catch(() => []),
      ])
      setRating(ratingData)
      setDailyBars(barsData)
      setView('rating')
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  async function trackTask<T>(
    starter: () => Promise<{ task_id: string }>,
    onDone?: (result: T) => void | Promise<void>,
    intervalMs = 3000,
  ) {
    setError('')
    try {
      const started = await starter()
      for (;;) {
        const current = await api.getTask(started.task_id) as TaskStatus<T>
        setTasks((prev) => upsertTask(prev, current))
        if (current.status === 'done') {
          if (current.result) await onDone?.(current.result)
          await refreshBase()
          if (selectedAccount?.account_id) await refreshAccount(selectedAccount.account_id)
          return current
        }
        if (current.status === 'failed') throw new Error(current.error ?? '任务失败')
        await sleep(intervalMs)
      }
    } catch (err) {
      setError(errorMessage(err))
    }
  }

  useEffect(() => {
    refreshBase()
  }, [])

  useEffect(() => {
    if (selectedAccount?.account_id) {
      setStrategy(selectedAccount.strategy_name)
      refreshAccount(selectedAccount.account_id).catch((err) => setError(errorMessage(err)))
    }
  }, [selectedAccount?.account_id])

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <BarChart3 size={22} />
          </div>
          <div>
            <strong>持仓研究台</strong>
            <span>A 股量化复盘</span>
          </div>
        </div>

        <nav className="nav-list">
          {navItems.map((item) => {
            const Icon = item.icon
            return (
              <button
                className={view === item.key ? 'nav-item active' : 'nav-item'}
                key={item.key}
                onClick={() => setView(item.key)}
                title={item.label}
                type="button"
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            )
          })}
        </nav>

        <div className="sidebar-panel">
          <div className="panel-kicker">API</div>
          <p>{api.baseUrl}</p>
          <p>{health ? `服务 ${health.status} / DB ${health.db}` : '等待连接后端'}</p>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">holdings research</p>
            <h1>{titleFor(view)}</h1>
          </div>
          <div className="topbar-actions">
            {selectedAccount && (
              <span className="account-chip">
                <BriefcaseBusiness size={16} />
                {selectedAccount.account_name}
              </span>
            )}
            <SegmentedStrategy strategies={strategies} value={strategy} onChange={setStrategy} />
            <button className="icon-button" onClick={refreshBase} title="刷新数据" type="button">
              <RefreshCw size={18} />
            </button>
          </div>
        </header>

        {error && <div className="alert error">{error}</div>}

        {loading ? (
          <section className="empty-state">正在连接后端 API...</section>
        ) : (
          <>
            {view === 'paper' && selectedAccount && (
              <PaperView
                accounts={accounts}
                selectedAccount={selectedAccount}
                positions={positions}
                trades={trades}
                equityCurve={equityCurve}
                dailyReport={dailyReport}
                tasks={tasks}
                onSelectAccount={setSelectedAccountId}
                onRatePosition={(code) => runRating(code, selectedAccount.strategy_name)}
                onRefresh={() => refreshAccount(selectedAccount.account_id).catch((err) => setError(errorMessage(err)))}
                onStoploss={() =>
                  api
                    .triggerStoploss(selectedAccount.account_id)
                    .then(() => refreshAccount(selectedAccount.account_id))
                    .catch((err) => setError(errorMessage(err)))
                }
                onSnapshot={() =>
                  api
                    .saveSnapshot(selectedAccount.account_id)
                    .then(() => refreshAccount(selectedAccount.account_id))
                    .catch((err) => setError(errorMessage(err)))
                }
                onAutoRebalance={(limit, enableNews) =>
                  trackTask<AutoRebalanceResult>(
                    () => api.runAutoRebalanceAsync(selectedAccount.account_id, limit, enableNews),
                    undefined,
                    3000,
                  )
                }
                onDailyRun={(params) =>
                  trackTask<DailyRunResult>(() => api.runDailyAsync(selectedAccount.account_id, params), undefined, 3000)
                }
              />
            )}
            {view === 'paper' && !selectedAccount && <section className="empty-state">后端暂无模拟账户。</section>}
            {view === 'rating' && (
              <RatingView
                positions={positions}
                selectedAccount={selectedAccount}
                strategies={strategies}
                strategy={strategy}
                rating={rating}
                dailyBars={dailyBars}
                selectedCode={selectedRatingCode}
                screenResult={screenResult}
                onStrategyChange={setStrategy}
                onRun={runRating}
                onRunScreen={(params) =>
                  trackTask<ScreenApiResult>(
                    () => api.runScreenAsync(params),
                    (result) => setScreenResult(result),
                    2500,
                  )
                }
              />
            )}
            {view === 'backtest' && (
              <BacktestView
                strategies={strategies}
                strategy={strategy}
                runs={backtests}
                tasks={tasks}
                onStrategyChange={setStrategy}
                onRun={(params) =>
                  trackTask(
                    () => api.runBacktestAsync(params),
                    () => api.getBacktests(undefined, 30).then(setBacktests),
                    10000,
                  )
                }
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

function PaperView({
  accounts,
  selectedAccount,
  positions,
  trades,
  equityCurve,
  dailyReport,
  tasks,
  onSelectAccount,
  onRatePosition,
  onRefresh,
  onStoploss,
  onSnapshot,
  onAutoRebalance,
  onDailyRun,
}: {
  accounts: AccountApiRow[]
  selectedAccount: AccountApiRow
  positions: PositionApiRow[]
  trades: TradeApiRow[]
  equityCurve: EquityApiPoint[]
  dailyReport: string
  tasks: TaskStatus[]
  onSelectAccount: (id: number) => void
  onRatePosition: (code: string) => void
  onRefresh: () => void
  onStoploss: () => void
  onSnapshot: () => void
  onAutoRebalance: (limit: number, enableNews: boolean) => void
  onDailyRun: (params: DailyRunParams) => void
}) {
  const [limit, setLimit] = useState(500)
  const [enableNews, setEnableNews] = useState(false)
  const [dryRun, setDryRun] = useState(true)
  const latestEquity = equityCurve.at(-1)
  const previousEquity = equityCurve.at(-2)
  const positionValue = positions.reduce((sum, item) => sum + (item.market_value ?? 0), 0)
  const unrealizedPct = positions.length
    ? positions.reduce((sum, item) => sum + (item.return_pct ?? 0), 0) / positions.length
    : 0
  const latestRebalance = tasks.find((task) => task.name === 'auto_rebalance' && task.status === 'done')
  const latestDailyRun = tasks.find((task) => task.name === 'daily_run' && task.status === 'done')

  return (
    <div className="page-stack">
      <section className="account-tabs">
        {accounts.map((account) => (
          <button
            key={account.account_id}
            className={selectedAccount.account_id === account.account_id ? 'active' : ''}
            onClick={() => onSelectAccount(account.account_id)}
            type="button"
          >
            <span>{account.account_name}</span>
            <strong>{cnMoney(account.current_equity)}</strong>
            <em className={toneFromNumber(account.return_pct)}>{signedPct(account.return_pct)}</em>
          </button>
        ))}
      </section>

      <section className="metric-grid">
        <MiniMetric label="当前权益" value={cnMoney(selectedAccount.current_equity)} tone="neutral" />
        <MiniMetric label="日权益变化" value={equityDelta(latestEquity, previousEquity)} tone={toneFromNumber((latestEquity?.daily_return ?? 0) * 100)} />
        <MiniMetric label="持仓市值" value={cnMoney(positionValue)} tone="neutral" />
        <MiniMetric label="平均浮盈亏" value={signedPct(unrealizedPct * 100)} tone={toneFromNumber(unrealizedPct * 100)} />
      </section>

      <section className="paper-grid">
        <div className="surface chart-surface">
          <SectionHeading eyebrow="账户权益" title="现金 / 持仓 / 总权益" icon={<ShieldCheck size={20} />} />
          <EquityChart data={equityCurve} />
        </div>
        <div className="surface">
          <SectionHeading eyebrow="调仓过程" title="任务摘要" icon={<Activity size={20} />} />
          <TaskSummary task={latestRebalance} title="最近自动调仓" />
          <TaskSummary task={latestDailyRun} title="最近每日流程" />
          <DailyReport report={dailyReport} />
        </div>
      </section>

      <section className="paper-grid lower">
        <PositionsTable positions={positions} onRatePosition={onRatePosition} />
        <div className="side-stack">
          <CommandPanel
            dryRun={dryRun}
            enableNews={enableNews}
            limit={limit}
            onDryRunChange={setDryRun}
            onEnableNewsChange={setEnableNews}
            onLimitChange={setLimit}
            onRefresh={onRefresh}
            onStoploss={onStoploss}
            onSnapshot={onSnapshot}
            onAutoRebalance={() => onAutoRebalance(limit, enableNews)}
            onDailyRun={() => onDailyRun({ limit, dryRun })}
          />
          <TradesTable trades={trades} />
        </div>
      </section>
    </div>
  )
}

function RatingView({
  positions,
  selectedAccount,
  strategies,
  strategy,
  rating,
  dailyBars,
  selectedCode,
  screenResult,
  onStrategyChange,
  onRun,
  onRunScreen,
}: {
  positions: PositionApiRow[]
  selectedAccount?: AccountApiRow
  strategies: Strategy[]
  strategy: Strategy
  rating: RatingApiResponse | null
  dailyBars: DailyBar[]
  selectedCode: string
  screenResult: ScreenApiResult | null
  onStrategyChange: (value: Strategy) => void
  onRun: (code: string, strategy: Strategy, noFlow?: boolean, noNews?: boolean) => void
  onRunScreen: (params: ScreenParams) => void
}) {
  const [code, setCode] = useState(selectedCode || positions[0]?.ts_code || '002028')
  const [noFlow, setNoFlow] = useState(false)
  const [noNews, setNoNews] = useState(false)
  const [screenOpen, setScreenOpen] = useState(false)

  useEffect(() => {
    if (selectedCode) setCode(selectedCode)
  }, [selectedCode])

  return (
    <div className="page-stack">
      <section className="toolbar-band">
        <div>
          <p className="eyebrow">{selectedAccount ? selectedAccount.account_name : 'manual research'}</p>
          <h2>从持仓进入评级解释</h2>
          <span>点击当前持仓查看五维评分，也可以手动输入股票代码补充研究。</span>
        </div>
        <div className="control-row">
          <SegmentedStrategy strategies={strategies} value={strategy} onChange={onStrategyChange} />
          <label className="search-box">
            <Search size={18} />
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="002028 或 600487.SH" />
          </label>
          <button className="primary-button" onClick={() => onRun(code, strategy, noFlow, noNews)} type="button">
            <Play size={17} />
            评级
          </button>
        </div>
      </section>

      <section className="compact-options surface">
        <label className="check-field">
          <input checked={noFlow} onChange={(event) => setNoFlow(event.target.checked)} type="checkbox" />
          <span>跳过资金面</span>
        </label>
        <label className="check-field">
          <input checked={noNews} onChange={(event) => setNoNews(event.target.checked)} type="checkbox" />
          <span>跳过消息面</span>
        </label>
      </section>

      <section className="rating-grid">
        <div className="surface">
          <SectionHeading eyebrow="当前账户" title="持仓入口" icon={<BriefcaseBusiness size={20} />} />
          <HoldingRatingList positions={positions} onSelect={(item) => onRun(item.ts_code, strategy, noFlow, noNews)} />
        </div>
        {rating ? (
          <RatingDetail rating={rating} dailyBars={dailyBars} />
        ) : (
          <section className="empty-state">从持仓中选择一只股票，或输入代码后点击评级。</section>
        )}
      </section>

      <section className="surface">
        <button className="disclosure-button" onClick={() => setScreenOpen((value) => !value)} type="button">
          <Sparkles size={18} />
          候选补充
          <ChevronDown className={screenOpen ? 'rotated' : ''} size={18} />
        </button>
        {screenOpen && (
          <AuxiliaryScreening
            strategy={strategy}
            result={screenResult}
            onRun={(params) => onRunScreen(params)}
          />
        )}
      </section>
    </div>
  )
}

function BacktestView({
  strategies,
  strategy,
  runs,
  tasks,
  onStrategyChange,
  onRun,
}: {
  strategies: Strategy[]
  strategy: Strategy
  runs: BacktestApiRun[]
  tasks: TaskStatus[]
  onStrategyChange: (value: Strategy) => void
  onRun: (params: BacktestParams) => void
}) {
  const [months, setMonths] = useState(12)
  const [limit, setLimit] = useState(300)
  const [top, setTop] = useState(0)
  const [capital, setCapital] = useState(100000)
  const [rebalWeeks, setRebalWeeks] = useState(2)
  const [formOpen, setFormOpen] = useState(false)
  const latestBacktest = tasks.find((task) => task.name === 'backtest')
  const comparison = useMemo(() => strategyComparison(runs), [runs])

  return (
    <div className="page-stack">
      <section className="metric-grid">
        <MiniMetric label="最近回测数" value={String(runs.length)} tone="neutral" />
        <MiniMetric label="最佳年化" value={signedPct(bestMetric(runs, 'ann_return') * 100)} tone={toneFromNumber(bestMetric(runs, 'ann_return') * 100)} />
        <MiniMetric label="最小回撤" value={signedPct(bestDrawdown(runs) * 100)} tone="neutral" />
        <MiniMetric label="平均 Sharpe" value={fixed(avgMetric(runs, 'sharpe'))} tone="neutral" />
      </section>

      <section className="backtest-grid">
        <div className="surface chart-surface">
          <SectionHeading eyebrow="策略对比" title="年化收益 / 最大回撤" icon={<BarChart3 size={20} />} />
          <BacktestChart data={comparison} />
        </div>
        <div className="surface">
          <SectionHeading eyebrow="异步任务" title="最近回测进度" icon={<Activity size={20} />} />
          <TaskSummary task={latestBacktest} title="回测任务" />
          <button className="disclosure-button secondary" onClick={() => setFormOpen((value) => !value)} type="button">
            <Play size={18} />
            发起新回测
            <ChevronDown className={formOpen ? 'rotated' : ''} size={18} />
          </button>
          {formOpen && (
            <div className="run-form">
              <SegmentedStrategy strategies={strategies} value={strategy} onChange={onStrategyChange} />
              <NumberField label="回测月数" value={months} onChange={setMonths} />
              <NumberField label="股票池规模" value={limit} onChange={setLimit} />
              <NumberField label="Top 数" value={top} onChange={setTop} hint="0=按资金自动" />
              <NumberField label="资金量" value={capital} onChange={setCapital} />
              <NumberField label="调仓周数" value={rebalWeeks} onChange={setRebalWeeks} />
              <button className="primary-button" onClick={() => onRun({ strategy, months, limit, top, capital, rebalWeeks })} type="button">
                <Play size={17} />
                跑回测
              </button>
            </div>
          )}
        </div>
      </section>

      <BacktestTable runs={runs} />
    </div>
  )
}

function CommandPanel({
  limit,
  enableNews,
  dryRun,
  onLimitChange,
  onEnableNewsChange,
  onDryRunChange,
  onRefresh,
  onStoploss,
  onSnapshot,
  onAutoRebalance,
  onDailyRun,
}: {
  limit: number
  enableNews: boolean
  dryRun: boolean
  onLimitChange: (value: number) => void
  onEnableNewsChange: (value: boolean) => void
  onDryRunChange: (value: boolean) => void
  onRefresh: () => void
  onStoploss: () => void
  onSnapshot: () => void
  onAutoRebalance: () => void
  onDailyRun: () => void
}) {
  return (
    <div className="surface command-panel">
      <SectionHeading eyebrow="操作区" title="调仓与复盘动作" />
      <NumberField label="选股股票池" value={limit} onChange={onLimitChange} />
      <label className="check-field">
        <input checked={enableNews} onChange={(event) => onEnableNewsChange(event.target.checked)} type="checkbox" />
        <span>调仓启用消息面</span>
      </label>
      <label className="check-field">
        <input checked={dryRun} onChange={(event) => onDryRunChange(event.target.checked)} type="checkbox" />
        <span>每日流程 dry-run</span>
      </label>
      <div className="command-grid">
        <button onClick={onRefresh} type="button"><RefreshCw size={17} />刷新</button>
        <button onClick={onStoploss} type="button"><ShieldCheck size={17} />止损</button>
        <button onClick={onSnapshot} type="button"><Activity size={17} />快照</button>
        <button onClick={onAutoRebalance} type="button"><Play size={17} />调仓</button>
        <button className="wide" onClick={onDailyRun} type="button"><Play size={17} />每日流程</button>
      </div>
    </div>
  )
}

function PositionsTable({
  positions,
  onRatePosition,
}: {
  positions: PositionApiRow[]
  onRatePosition: (code: string) => void
}) {
  return (
    <div className="surface table-surface">
      <SectionHeading eyebrow="持仓变化" title="当前持仓与浮盈亏" />
      {positions.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>股票</th>
                <th>数量</th>
                <th>成本</th>
                <th>现价</th>
                <th>浮盈亏</th>
                <th>市值</th>
                <th>价格源</th>
                <th>研究</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.ts_code}>
                  <td>
                    <strong>{position.ts_code}</strong>
                    <span>开仓 {formatDate(position.open_date)}</span>
                  </td>
                  <td>{position.qty}</td>
                  <td>{fixed(position.avg_cost)}</td>
                  <td>{fixed(position.current_price ?? 0)}</td>
                  <td className={toneFromNumber((position.return_pct ?? 0) * 100)}>{signedPct((position.return_pct ?? 0) * 100)}</td>
                  <td>{cnMoney(position.market_value ?? 0)}</td>
                  <td>{priceSourceLabel(position.price_source)}</td>
                  <td>
                    <button className="link-button" onClick={() => onRatePosition(position.ts_code)} type="button">评级</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">当前账户暂无持仓。</p>
      )}
    </div>
  )
}

function TradesTable({ trades }: { trades: TradeApiRow[] }) {
  return (
    <div className="surface table-surface">
      <SectionHeading eyebrow="交易流水" title="最近成交" />
      <div className="trade-list">
        {trades.length ? trades.map((trade) => (
          <div key={trade.trade_id} className="trade-item">
            <span className={trade.side === 'BUY' ? 'positive pill' : 'negative pill'}>{trade.side}</span>
            <div>
              <strong>{trade.ts_code}</strong>
              <small>{trade.trade_date} · {trade.reason ?? 'MANUAL'} · 佣金 {fixed(trade.commission)}</small>
            </div>
            <b>{trade.qty} @ {fixed(trade.price)}</b>
          </div>
        )) : <p className="muted">暂无成交记录。</p>}
      </div>
    </div>
  )
}

function HoldingRatingList({
  positions,
  onSelect,
}: {
  positions: PositionApiRow[]
  onSelect: (position: PositionApiRow) => void
}) {
  if (!positions.length) return <p className="muted">当前账户暂无持仓，可使用右上角输入框手动评级。</p>
  return (
    <div className="holding-list">
      {positions.map((position) => (
        <button key={position.ts_code} onClick={() => onSelect(position)} type="button">
          <span>
            <strong>{position.ts_code}</strong>
            <em>成本 {fixed(position.avg_cost)} · 市值 {cnMoney(position.market_value ?? 0)}</em>
          </span>
          <b className={toneFromNumber((position.return_pct ?? 0) * 100)}>{signedPct((position.return_pct ?? 0) * 100)}</b>
        </button>
      ))}
    </div>
  )
}

function RatingDetail({ rating, dailyBars }: { rating: RatingApiResponse; dailyBars: DailyBar[] }) {
  return (
    <div className="rating-detail-grid">
      <div className="surface rating-summary">
        <p className="eyebrow">{rating.ts_code} · {rating.asof}</p>
        <h2>{rating.name || '未命名股票'}</h2>
        <div className="grade-ring" style={{ '--grade-pct': `${((rating.overall_stars ?? 0) / 5) * 100}%` } as React.CSSProperties}>
          <span>{rating.grade}</span>
          <strong>{fixed(rating.overall_stars ?? 0, 2)} 星</strong>
        </div>
        <p>{strategyLabels[rating.strategy]}策略 · 评级用于解释当前持仓质量，不构成交易建议。</p>
      </div>
      <div className="surface chart-surface">
        <SectionHeading eyebrow="近期走势" title="90 日收盘价" />
        <DailyChart data={dailyBars} />
      </div>
      <div className="surface dimension-surface">
        <SectionHeading eyebrow="维度拆解" title="评分与因子说明" />
        <div className="dimension-list">
          {rating.dimensions.map((dimension) => (
            <div className="dimension-card" key={dimension.key}>
              <div className="dimension-item">
                <div>
                  <strong>{dimension.label}</strong>
                  <span>权重 {dimension.weight}</span>
                </div>
                <div className="score-line"><i style={{ width: `${((dimension.stars ?? 0) / 5) * 100}%` }} /></div>
                <b>{fixed(dimension.stars ?? 0, 1)}</b>
              </div>
              <ul>
                {dimension.factors.map((factor) => (
                  <li key={factor.key}>
                    <span>{factor.key}</span>
                    <em>{factor.desc}</em>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function AuxiliaryScreening({
  strategy,
  result,
  onRun,
}: {
  strategy: Strategy
  result: ScreenApiResult | null
  onRun: (params: ScreenParams) => void
}) {
  const [capital, setCapital] = useState(100000)
  const [top, setTop] = useState(0)
  const [limit, setLimit] = useState(300)
  const [lookback, setLookback] = useState(60)
  const [enableNews, setEnableNews] = useState(false)

  return (
    <div className="aux-screening">
      <div className="form-grid">
        <NumberField label="资金量" value={capital} onChange={setCapital} />
        <NumberField label="指定 Top" value={top} onChange={setTop} hint="0=自动" />
        <NumberField label="股票池" value={limit} onChange={setLimit} />
        <NumberField label="回看天数" value={lookback} onChange={setLookback} />
        <label className="check-field">
          <input checked={enableNews} onChange={(event) => setEnableNews(event.target.checked)} type="checkbox" />
          <span>启用消息面</span>
        </label>
        <button className="primary-button" onClick={() => onRun({ strategy, capital, top, limit, lookback, enableNews })} type="button">
          <Play size={17} />
          跑候选
        </button>
      </div>
      <PickTable picks={result?.picks ?? []} />
    </div>
  )
}

function PickTable({ picks }: { picks: ScreenApiPick[] }) {
  if (!picks.length) return <p className="muted">候选结果会在异步选股完成后显示。</p>
  return (
    <div className="table-wrap compact-table">
      <table>
        <thead>
          <tr>
            <th>排名</th>
            <th>股票</th>
            <th>得分</th>
          </tr>
        </thead>
        <tbody>
          {picks.map((pick) => (
            <tr key={pick.ts_code}>
              <td>#{pick.rank_num}</td>
              <td>
                <strong>{pick.name ?? '未知'}</strong>
                <span>{pick.ts_code}</span>
              </td>
              <td>{fixed(pick.score)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BacktestTable({ runs }: { runs: BacktestApiRun[] }) {
  return (
    <div className="surface table-surface">
      <SectionHeading eyebrow="历史记录" title="最近回测结果" />
      {runs.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>策略</th>
                <th>区间</th>
                <th>年化</th>
                <th>回撤</th>
                <th>Sharpe</th>
                <th>胜率</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((run) => (
                <tr key={run.run_id}>
                  <td>#{run.run_id}</td>
                  <td>{strategyLabels[run.strategy_name]}</td>
                  <td>{run.start_date} ~ {run.end_date}</td>
                  <td className={toneFromNumber((run.ann_return ?? 0) * 100)}>{signedPct((run.ann_return ?? 0) * 100)}</td>
                  <td>{signedPct((run.max_drawdown ?? 0) * 100)}</td>
                  <td>{fixed(run.sharpe ?? 0)}</td>
                  <td>{signedPct((run.win_rate ?? 0) * 100)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">暂无回测记录。</p>
      )}
    </div>
  )
}

function EquityChart({ data }: { data: EquityApiPoint[] }) {
  if (!data.length) return <div className="chart-empty">暂无净值快照</div>
  return (
    <ResponsiveContainer width="100%" height={286}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="equity" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#0f9f88" stopOpacity={0.26} />
            <stop offset="95%" stopColor="#0f9f88" stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="market" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#5470c6" stopOpacity={0.18} />
            <stop offset="95%" stopColor="#5470c6" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="trade_date" />
        <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
        <Tooltip formatter={(value) => cnMoney(Number(value))} />
        <Area type="monotone" dataKey="total_equity" name="总权益" stroke="#0f9f88" fill="url(#equity)" strokeWidth={2.5} />
        <Area type="monotone" dataKey="market_value" name="持仓市值" stroke="#5470c6" fill="url(#market)" strokeWidth={2} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function DailyChart({ data }: { data: DailyBar[] }) {
  if (!data.length) return <div className="chart-empty">暂无日线数据</div>
  return (
    <ResponsiveContainer width="100%" height={230}>
      <ReLineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="trade_date" />
        <YAxis domain={['dataMin', 'dataMax']} />
        <Tooltip formatter={(value) => fixed(Number(value))} />
        <Line type="monotone" dataKey="close" name="收盘价" stroke="#0f9f88" strokeWidth={2.4} dot={false} />
      </ReLineChart>
    </ResponsiveContainer>
  )
}

function BacktestChart({ data }: { data: Array<{ strategy: string; ann_return: number; max_drawdown: number }> }) {
  if (!data.length) return <div className="chart-empty">暂无回测记录</div>
  return (
    <ResponsiveContainer width="100%" height={286}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="strategy" />
        <YAxis tickFormatter={(value) => signedPct(Number(value) * 100)} />
        <Tooltip formatter={(value) => signedPct(Number(value) * 100)} />
        <Bar dataKey="ann_return" name="年化收益" fill="#0f9f88" radius={[4, 4, 0, 0]} />
        <Bar dataKey="max_drawdown" name="最大回撤" fill="#c45d5d" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

function TaskSummary({ task, title }: { task?: TaskStatus; title: string }) {
  if (!task) {
    return (
      <div className="task-card quiet">
        <strong>{title}</strong>
        <p>暂无记录。</p>
      </div>
    )
  }
  const rebalance = task.result as AutoRebalanceResult | undefined
  const daily = task.result as DailyRunResult | undefined
  return (
    <div className="task-card">
      <div className="task-head">
        <span>{statusIcon(task.status)}</span>
        <strong>{title}</strong>
        <em>{task.status}</em>
      </div>
      <div className="progress-line"><i style={{ width: `${Math.max(0, Math.min(task.progress ?? 0, 100))}%` }} /></div>
      <p>{task.progress_msg || task.error || task.task_id}</p>
      {rebalance?.sold && (
        <dl className="summary-dl">
          <dt>卖出</dt><dd>{rebalance.sold.n ?? 0} 笔 / {cnMoney(rebalance.sold.revenue ?? 0)}</dd>
          <dt>买入</dt><dd>{rebalance.bought?.n ?? 0} 笔 / {cnMoney(rebalance.bought?.spent ?? 0)}</dd>
          <dt>权益</dt><dd>{cnMoney(rebalance.total_equity ?? 0)}</dd>
        </dl>
      )}
      {daily?.log && <pre className="log-preview">{daily.log.slice(0, 460)}</pre>}
    </div>
  )
}

function DailyReport({ report }: { report: string }) {
  if (!report) return null
  return (
    <details className="report-box">
      <summary>单日复盘报告</summary>
      <pre>{report}</pre>
    </details>
  )
}

function SectionHeading({ eyebrow, title, icon }: { eyebrow: string; title: string; icon?: React.ReactNode }) {
  return (
    <div className="section-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {icon}
    </div>
  )
}

function SegmentedStrategy({
  strategies,
  value,
  onChange,
}: {
  strategies: Strategy[]
  value: Strategy
  onChange: (value: Strategy) => void
}) {
  return (
    <div className="segmented" aria-label="策略选择">
      {strategies.map((key) => (
        <button
          key={key}
          className={value === key ? 'selected' : ''}
          onClick={() => onChange(key)}
          title={strategyDescriptions[key]}
          type="button"
        >
          {strategyLabels[key]}
        </button>
      ))}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  hint?: string
}) {
  return (
    <label className="number-field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(Number(event.target.value))} min={0} type="number" />
      {hint && <em>{hint}</em>}
    </label>
  )
}

function MiniMetric({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="metric-card mini">
      <span>{label}</span>
      <strong className={tone}>{value}</strong>
    </div>
  )
}

function titleFor(view: View) {
  return {
    paper: '模拟盘复盘',
    rating: '持仓评级',
    backtest: '回测表现',
  }[view]
}

function equityDelta(latest?: EquityApiPoint, previous?: EquityApiPoint) {
  if (latest?.daily_return !== undefined && latest.daily_return !== null) return signedPct(latest.daily_return * 100)
  if (!latest || !previous || !previous.total_equity) return '-'
  return signedPct((latest.total_equity / previous.total_equity - 1) * 100)
}

function priceSourceLabel(source?: string | null) {
  return ({ realtime: '实时', close: '收盘', cost: '成本' } as Record<string, string>)[source ?? ''] ?? source ?? '-'
}

function strategyComparison(runs: BacktestApiRun[]) {
  return Object.entries(
    runs.reduce<Record<string, BacktestApiRun[]>>((acc, run) => {
      acc[run.strategy_name] = [...(acc[run.strategy_name] ?? []), run]
      return acc
    }, {}),
  ).map(([key, items]) => ({
    strategy: strategyLabels[key as Strategy] ?? key,
    ann_return: avgMetric(items, 'ann_return'),
    max_drawdown: avgMetric(items, 'max_drawdown'),
  }))
}

function bestMetric(runs: BacktestApiRun[], key: 'ann_return' | 'sharpe') {
  return runs.reduce((best, run) => Math.max(best, Number(run[key] ?? Number.NEGATIVE_INFINITY)), 0)
}

function bestDrawdown(runs: BacktestApiRun[]) {
  if (!runs.length) return 0
  return runs.reduce((best, run) => Math.max(best, Number(run.max_drawdown ?? Number.NEGATIVE_INFINITY)), Number.NEGATIVE_INFINITY)
}

function avgMetric(runs: BacktestApiRun[], key: 'ann_return' | 'max_drawdown' | 'sharpe') {
  const values = runs.map((run) => run[key]).filter((value): value is number => typeof value === 'number')
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function errorMessage(err: unknown) {
  if (err instanceof ApiError) return `${err.message}${err.code ? ` (${err.code})` : ''}`
  if (err instanceof Error) return err.message
  return '未知错误'
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function upsertTask(tasks: TaskStatus[], task: TaskStatus) {
  const next = [task, ...tasks.filter((item) => item.task_id !== task.task_id)]
  return next.slice(0, 12)
}

function statusIcon(status: string) {
  if (status === 'done') return <CheckCircle2 size={16} />
  if (status === 'failed') return <XCircle size={16} />
  return <Loader2 className="spin" size={16} />
}

function formatDate(value: string) {
  return value ? value.slice(0, 10) : '-'
}

export default App
