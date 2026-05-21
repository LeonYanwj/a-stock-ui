import {
  Activity,
  BarChart3,
  CandlestickChart,
  CheckCircle2,
  Gauge,
  LineChart,
  Loader2,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
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
  EquityApiPoint,
  PositionApiRow,
  RatingApiResponse,
  ScreenApiPick,
  ScreenApiResult,
  Strategy,
  TaskStatus,
  TradeApiRow,
} from './types'

type View = 'dashboard' | 'screen' | 'rating' | 'paper' | 'backtest'

const navItems: Array<{ key: View; label: string; icon: typeof Gauge }> = [
  { key: 'dashboard', label: '总览', icon: Gauge },
  { key: 'screen', label: '选股', icon: CandlestickChart },
  { key: 'rating', label: '评级', icon: Search },
  { key: 'paper', label: '模拟盘', icon: WalletCards },
  { key: 'backtest', label: '回测', icon: LineChart },
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
  const [view, setView] = useState<View>('dashboard')
  const [strategy, setStrategy] = useState<Strategy>('swing')
  const [strategies, setStrategies] = useState<Strategy[]>(['short_term', 'swing', 'trend', 'ic_optimized'])
  const [health, setHealth] = useState<{ status: string; db: string } | null>(null)
  const [accounts, setAccounts] = useState<AccountApiRow[]>([])
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null)
  const [positions, setPositions] = useState<PositionApiRow[]>([])
  const [trades, setTrades] = useState<TradeApiRow[]>([])
  const [equityCurve, setEquityCurve] = useState<EquityApiPoint[]>([])
  const [backtests, setBacktests] = useState<BacktestApiRun[]>([])
  const [screenResult, setScreenResult] = useState<ScreenApiResult | null>(null)
  const [rating, setRating] = useState<RatingApiResponse | null>(null)
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
        api.getBacktests(undefined, 20),
        api.getTasks(undefined, undefined, 8),
      ])
      setHealth(healthData)
      setStrategies(strategyData.strategies)
      setAccounts(accountData)
      setBacktests(backtestData)
      setTasks(taskData)
      if (accountData.length && selectedAccountId === null) {
        setSelectedAccountId(accountData[0].account_id)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function refreshAccount(accountId: number) {
    const [positionData, tradeData, curveData] = await Promise.all([
      api.getPositions(accountId, true),
      api.getTrades(accountId, 20),
      api.getEquityCurve(accountId),
    ])
    setPositions(positionData)
    setTrades(tradeData)
    setEquityCurve(curveData)
  }

  useEffect(() => {
    refreshBase()
  }, [])

  useEffect(() => {
    if (selectedAccount?.account_id) {
      refreshAccount(selectedAccount.account_id).catch((err) => setError(errorMessage(err)))
    }
  }, [selectedAccount?.account_id])

  async function trackTask<T>(
    starter: () => Promise<{ task_id: string }>,
    onDone?: (result: T) => void | Promise<void>,
    intervalMs = 2500,
  ) {
    setError('')
    const started = await starter()
    for (;;) {
      const current = await api.getTask(started.task_id) as TaskStatus<T>
      if (!current) {
        throw new Error('任务状态为空')
      }
      setTasks((prev) => upsertTask(prev, current))
      if (current.status === 'done') {
        if (current.result) {
          await onDone?.(current.result)
        }
        await refreshBase()
        return current
      }
      if (current.status === 'failed') {
        throw new Error(current.error ?? '任务失败')
      }
      await sleep(intervalMs)
    }
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <BarChart3 size={22} />
          </div>
          <div>
            <strong>A 股量化</strong>
            <span>FastAPI Console</span>
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
          <p>后端启动：python -m uvicorn api.main:app --host 0.0.0.0 --port 8000</p>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">a-stock-analyzer</p>
            <h1>{titleFor(view)}</h1>
          </div>
          <div className="topbar-actions">
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
            {view === 'dashboard' && (
              <Dashboard
                health={health}
                accounts={accounts}
                selectedAccount={selectedAccount}
                positions={positions}
                equityCurve={equityCurve}
                tasks={tasks}
              />
            )}
            {view === 'screen' && (
              <Screening
                strategy={strategy}
                onStrategyChange={setStrategy}
                strategies={strategies}
                result={screenResult}
                onRun={(params) =>
                  trackTask<ScreenApiResult>(
                    () => api.runScreenAsync(params),
                    (result) => setScreenResult(result),
                  ).catch((err) => setError(errorMessage(err)))
                }
              />
            )}
            {view === 'rating' && (
              <RatingView
                rating={rating}
                onRun={(code, noFlow, noNews) =>
                  api
                    .getRating(code, strategy, noFlow, noNews)
                    .then(setRating)
                    .catch((err) => setError(errorMessage(err)))
                }
              />
            )}
            {view === 'paper' && selectedAccount && (
              <PaperView
                accounts={accounts}
                selectedAccount={selectedAccount}
                onSelectAccount={setSelectedAccountId}
                positions={positions}
                trades={trades}
                equityCurve={equityCurve}
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
                  trackTask(
                    () => api.runAutoRebalanceAsync(selectedAccount.account_id, limit, enableNews),
                    () => refreshAccount(selectedAccount.account_id),
                    3000,
                  ).catch((err) => setError(errorMessage(err)))
                }
                onDailyRun={(params) =>
                  trackTask(
                    () => api.runDailyAsync(selectedAccount.account_id, params),
                    () => refreshAccount(selectedAccount.account_id),
                    3000,
                  ).catch((err) => setError(errorMessage(err)))
                }
              />
            )}
            {view === 'backtest' && (
              <BacktestView
                strategy={strategy}
                runs={backtests}
                onRun={(params) =>
                  trackTask(
                    () => api.runBacktestAsync(params),
                    () => api.getBacktests(undefined, 20).then(setBacktests),
                    10000,
                  ).catch((err) => setError(errorMessage(err)))
                }
              />
            )}
          </>
        )}
      </main>
    </div>
  )
}

function Dashboard({
  health,
  accounts,
  selectedAccount,
  positions,
  equityCurve,
  tasks,
}: {
  health: { status: string; db: string } | null
  accounts: AccountApiRow[]
  selectedAccount?: AccountApiRow
  positions: PositionApiRow[]
  equityCurve: EquityApiPoint[]
  tasks: TaskStatus[]
}) {
  const totalEquity = accounts.reduce((sum, account) => sum + account.current_equity, 0)
  const totalCash = accounts.reduce((sum, account) => sum + account.current_cash, 0)
  const latestEquity = equityCurve.at(-1)
  const runningTasks = tasks.filter((task) => task.status === 'running' || task.status === 'pending')

  return (
    <div className="page-stack">
      <section className="metric-grid">
        <MiniMetric label="API 状态" value={health ? `${health.status} / DB ${health.db}` : 'unknown'} tone={health?.status === 'ok' ? 'positive' : 'negative'} />
        <MiniMetric label="总权益" value={cnMoney(totalEquity)} tone="neutral" />
        <MiniMetric label="总现金" value={cnMoney(totalCash)} tone="neutral" />
        <MiniMetric label="运行任务" value={String(runningTasks.length)} tone={runningTasks.length ? 'negative' : 'positive'} />
      </section>

      <section className="split-layout">
        <div className="surface chart-surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">账户净值</p>
              <h2>{selectedAccount?.account_name ?? '暂无账户'}</h2>
            </div>
            <ShieldCheck size={20} />
          </div>
          <EquityChart data={equityCurve} />
        </div>

        <div className="surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">任务</p>
              <h2>最近任务</h2>
            </div>
            <Activity size={20} />
          </div>
          <TaskList tasks={tasks} />
        </div>
      </section>

      <section className="split-layout lower">
        <div className="surface account-list">
          <div className="section-heading">
            <div>
              <p className="eyebrow">账户</p>
              <h2>模拟盘账户</h2>
            </div>
          </div>
          {accounts.length ? accounts.map((account) => <AccountRow account={account} key={account.account_id} />) : <p className="muted">后端暂无模拟账户。</p>}
        </div>
        <PositionsTable positions={positions} />
      </section>

      {latestEquity && (
        <section className="strategy-strip">
          <div className="strategy-tile">
            <span>现金</span>
            <strong>{cnMoney(latestEquity.cash)}</strong>
            <p>最近权益快照</p>
          </div>
          <div className="strategy-tile">
            <span>持仓市值</span>
            <strong>{cnMoney(latestEquity.market_value)}</strong>
            <p>{latestEquity.trade_date}</p>
          </div>
          <div className="strategy-tile">
            <span>总权益</span>
            <strong>{cnMoney(latestEquity.total_equity)}</strong>
            <p>来自 /api/accounts/id/equity</p>
          </div>
          <div className="strategy-tile">
            <span>持仓数</span>
            <strong>{positions.length}</strong>
            <p>实时价优先，失败降级收盘价</p>
          </div>
        </section>
      )}
    </div>
  )
}

function Screening({
  strategy,
  strategies,
  result,
  onStrategyChange,
  onRun,
}: {
  strategy: Strategy
  strategies: Strategy[]
  result: ScreenApiResult | null
  onStrategyChange: (value: Strategy) => void
  onRun: (params: ScreenParams) => void
}) {
  const [capital, setCapital] = useState(100000)
  const [top, setTop] = useState(0)
  const [limit, setLimit] = useState(500)
  const [lookback, setLookback] = useState(60)
  const [enableNews, setEnableNews] = useState(false)
  const [optimalTop, setOptimalTop] = useState<number | null>(null)

  useEffect(() => {
    if (capital > 0) {
      api.getOptimalTopN(capital).then((data) => setOptimalTop(data.top_n)).catch(() => setOptimalTop(null))
    }
  }, [capital])

  return (
    <div className="page-stack">
      <section className="toolbar-band">
        <div>
          <p className="eyebrow">POST /api/screen/async</p>
          <h2>{strategyLabels[strategy]}选股任务</h2>
          <span>{strategyDescriptions[strategy]}</span>
        </div>
        <div className="control-row">
          <SegmentedStrategy strategies={strategies} value={strategy} onChange={onStrategyChange} />
          <button
            className="primary-button"
            onClick={() => onRun({ strategy, capital, top, limit, lookback, enableNews })}
            type="button"
          >
            <Play size={17} />
            异步选股
          </button>
        </div>
      </section>

      <section className="form-grid surface">
        <NumberField label="资金量" value={capital} onChange={setCapital} />
        <NumberField label="指定 Top" value={top} onChange={setTop} hint={optimalTop ? `0=自动，建议 ${optimalTop} 只` : '0=自动'} />
        <NumberField label="股票池规模" value={limit} onChange={setLimit} />
        <NumberField label="回看天数" value={lookback} onChange={setLookback} />
        <label className="check-field">
          <input checked={enableNews} onChange={(event) => setEnableNews(event.target.checked)} type="checkbox" />
          <span>启用消息面精筛</span>
        </label>
      </section>

      <PickTable picks={result?.picks ?? []} />
    </div>
  )
}

function RatingView({
  rating,
  onRun,
}: {
  rating: RatingApiResponse | null
  onRun: (code: string, noFlow: boolean, noNews: boolean) => void
}) {
  const [code, setCode] = useState('002028')
  const [noFlow, setNoFlow] = useState(false)
  const [noNews, setNoNews] = useState(false)

  return (
    <div className="page-stack">
      <section className="toolbar-band">
        <div>
          <p className="eyebrow">GET /api/rate/{'{code}'}</p>
          <h2>单股五维评级</h2>
          <span>返回 overall_stars、grade、维度权重和因子解释。</span>
        </div>
        <div className="control-row">
          <label className="search-box">
            <Search size={18} />
            <input value={code} onChange={(event) => setCode(event.target.value)} placeholder="002028 或 600487.SH" />
          </label>
          <button className="primary-button" onClick={() => onRun(code, noFlow, noNews)} type="button">
            <Play size={17} />
            评级
          </button>
        </div>
      </section>

      <section className="form-grid surface compact-form">
        <label className="check-field">
          <input checked={noFlow} onChange={(event) => setNoFlow(event.target.checked)} type="checkbox" />
          <span>跳过资金面</span>
        </label>
        <label className="check-field">
          <input checked={noNews} onChange={(event) => setNoNews(event.target.checked)} type="checkbox" />
          <span>跳过消息面</span>
        </label>
      </section>

      {rating ? (
        <section className="rating-layout">
          <div className="surface rating-summary">
            <p className="eyebrow">{rating.ts_code} · {rating.asof}</p>
            <h2>{rating.name || '未命名股票'}</h2>
            <div className="grade-ring" style={{ '--grade-pct': `${((rating.overall_stars ?? 0) / 5) * 100}%` } as React.CSSProperties}>
              <span>{rating.grade}</span>
              <strong>{fixed(rating.overall_stars ?? 0, 2)} 星</strong>
            </div>
            <p>{strategyLabels[rating.strategy]}策略 · 综合评级来自后端 `single_grader`。</p>
          </div>

          <div className="surface">
            <div className="section-heading">
              <div>
                <p className="eyebrow">维度拆解</p>
                <h2>评分与因子说明</h2>
              </div>
            </div>
            <div className="dimension-list">
              {rating.dimensions.map((dimension) => (
                <div className="dimension-card" key={dimension.key}>
                  <div className="dimension-item">
                    <div>
                      <strong>{dimension.label}</strong>
                      <span>权重 {dimension.weight}</span>
                    </div>
                    <div className="score-line">
                      <i style={{ width: `${((dimension.stars ?? 0) / 5) * 100}%` }} />
                    </div>
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
        </section>
      ) : (
        <section className="empty-state">输入股票代码后点击评级。</section>
      )}
    </div>
  )
}

function PaperView({
  accounts,
  selectedAccount,
  onSelectAccount,
  positions,
  trades,
  equityCurve,
  onRefresh,
  onStoploss,
  onSnapshot,
  onAutoRebalance,
  onDailyRun,
}: {
  accounts: AccountApiRow[]
  selectedAccount: AccountApiRow
  onSelectAccount: (id: number) => void
  positions: PositionApiRow[]
  trades: TradeApiRow[]
  equityCurve: EquityApiPoint[]
  onRefresh: () => void
  onStoploss: () => void
  onSnapshot: () => void
  onAutoRebalance: (limit: number, enableNews: boolean) => void
  onDailyRun: (params: DailyRunParams) => void
}) {
  const [limit, setLimit] = useState(500)
  const [enableNews, setEnableNews] = useState(false)
  const [dryRun, setDryRun] = useState(true)

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
          </button>
        ))}
      </section>

      <section className="metric-grid">
        <MiniMetric label="当前权益" value={cnMoney(selectedAccount.current_equity)} tone="neutral" />
        <MiniMetric label="现金" value={cnMoney(selectedAccount.current_cash)} tone="neutral" />
        <MiniMetric label="累计收益" value={signedPct(selectedAccount.return_pct)} tone={toneFromNumber(selectedAccount.return_pct)} />
        <MiniMetric label="策略" value={strategyLabels[selectedAccount.strategy_name]} tone="neutral" />
      </section>

      <section className="split-layout">
        <div className="surface chart-surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">GET /api/accounts/{'{id}'}/equity</p>
              <h2>账户权益</h2>
            </div>
          </div>
          <EquityChart data={equityCurve} />
        </div>
        <div className="surface command-panel">
          <div className="section-heading">
            <div>
              <p className="eyebrow">账户动作</p>
              <h2>异步任务与快照</h2>
            </div>
          </div>
          <NumberField label="选股股票池" value={limit} onChange={setLimit} />
          <label className="check-field">
            <input checked={enableNews} onChange={(event) => setEnableNews(event.target.checked)} type="checkbox" />
            <span>调仓启用消息面</span>
          </label>
          <label className="check-field">
            <input checked={dryRun} onChange={(event) => setDryRun(event.target.checked)} type="checkbox" />
            <span>每日流程 dry-run</span>
          </label>
          <button onClick={onRefresh} type="button">
            <RefreshCw size={18} />
            刷新账户
          </button>
          <button onClick={onStoploss} type="button">
            <ShieldCheck size={18} />
            止损检查
          </button>
          <button onClick={onSnapshot} type="button">
            <Activity size={18} />
            保存快照
          </button>
          <button onClick={() => onAutoRebalance(limit, enableNews)} type="button">
            <Play size={18} />
            自动调仓
          </button>
          <button onClick={() => onDailyRun({ limit, dryRun })} type="button">
            <Play size={18} />
            每日流程
          </button>
        </div>
      </section>

      <section className="split-layout lower">
        <PositionsTable positions={positions} />
        <TradesTable trades={trades} />
      </section>
    </div>
  )
}

function BacktestView({
  strategy,
  runs,
  onRun,
}: {
  strategy: Strategy
  runs: BacktestApiRun[]
  onRun: (params: BacktestParams) => void
}) {
  const [months, setMonths] = useState(12)
  const [limit, setLimit] = useState(300)
  const [top, setTop] = useState(0)
  const [capital, setCapital] = useState(100000)
  const [rebalWeeks, setRebalWeeks] = useState(2)

  return (
    <div className="page-stack">
      <section className="toolbar-band">
        <div>
          <p className="eyebrow">POST /api/backtest/run/async</p>
          <h2>异步回测</h2>
          <span>回测可能运行数分钟到十几分钟，前端会轮询 /api/tasks。</span>
        </div>
        <button
          className="primary-button"
          onClick={() => onRun({ strategy, months, limit, top, capital, rebalWeeks })}
          type="button"
        >
          <Play size={17} />
          跑回测
        </button>
      </section>

      <section className="form-grid surface">
        <NumberField label="回测月数" value={months} onChange={setMonths} />
        <NumberField label="股票池规模" value={limit} onChange={setLimit} />
        <NumberField label="Top 数" value={top} onChange={setTop} hint="0=按资金自动" />
        <NumberField label="资金量" value={capital} onChange={setCapital} />
        <NumberField label="调仓周数" value={rebalWeeks} onChange={setRebalWeeks} />
      </section>

      <section className="split-layout">
        <div className="surface chart-surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">历史表现</p>
              <h2>年化收益 / 最大回撤</h2>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={runs}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="run_id" />
              <YAxis tickFormatter={(value) => signedPct(Number(value) * 100)} />
              <Tooltip formatter={(value) => signedPct(Number(value) * 100)} />
              <Bar dataKey="ann_return" fill="#0f9f88" radius={[4, 4, 0, 0]} />
              <Bar dataKey="max_drawdown" fill="#c44b4b" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="surface table-surface">
          <div className="section-heading">
            <div>
              <p className="eyebrow">GET /api/backtest</p>
              <h2>最近回测</h2>
            </div>
          </div>
          <div className="backtest-list">
            {runs.map((run) => (
              <div className="backtest-item" key={run.run_id}>
                <div>
                  <strong>Run #{run.run_id}</strong>
                  <span>{run.start_date} ~ {run.end_date} · {strategyLabels[run.strategy_name]}</span>
                </div>
                <dl>
                  <dt>年化</dt>
                  <dd className={toneFromNumber((run.ann_return ?? 0) * 100)}>{signedPct((run.ann_return ?? 0) * 100)}</dd>
                  <dt>回撤</dt>
                  <dd>{signedPct((run.max_drawdown ?? 0) * 100)}</dd>
                  <dt>Sharpe</dt>
                  <dd>{fixed(run.sharpe ?? 0)}</dd>
                </dl>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

function PickTable({ picks }: { picks: ScreenApiPick[] }) {
  return (
    <div className="surface table-surface">
      <div className="section-heading">
        <div>
          <p className="eyebrow">选股结果</p>
          <h2>Top {picks.length}</h2>
        </div>
        <Activity size={20} />
      </div>
      {picks.length ? (
        <div className="table-wrap">
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
      ) : (
        <p className="muted">还没有选股结果。提交异步任务后，任务完成会在这里展示 picks。</p>
      )}
    </div>
  )
}

function PositionsTable({ positions }: { positions: PositionApiRow[] }) {
  return (
    <div className="surface table-surface">
      <div className="section-heading">
        <div>
          <p className="eyebrow">GET /positions</p>
          <h2>当前持仓</h2>
        </div>
      </div>
      {positions.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>股票</th>
                <th>数量</th>
                <th>成本</th>
                <th>现价</th>
                <th>收益</th>
                <th>价格源</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((position) => (
                <tr key={position.ts_code}>
                  <td>
                    <strong>{position.ts_code}</strong>
                    <span>{position.open_date}</span>
                  </td>
                  <td>{position.qty}</td>
                  <td>{fixed(position.avg_cost)}</td>
                  <td>{fixed(position.current_price ?? 0)}</td>
                  <td className={toneFromNumber((position.return_pct ?? 0) * 100)}>{signedPct((position.return_pct ?? 0) * 100)}</td>
                  <td>{position.price_source ?? '-'}</td>
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
      <div className="section-heading">
        <div>
          <p className="eyebrow">GET /trades</p>
          <h2>最近交易</h2>
        </div>
      </div>
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

function EquityChart({ data }: { data: EquityApiPoint[] }) {
  if (!data.length) {
    return <div className="chart-empty">暂无净值快照</div>
  }

  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="equity" x1="0" x2="0" y1="0" y2="1">
            <stop offset="5%" stopColor="#0f9f88" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#0f9f88" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey="trade_date" />
        <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
        <Tooltip formatter={(value) => cnMoney(Number(value))} />
        <Area type="monotone" dataKey="total_equity" stroke="#0f9f88" fill="url(#equity)" strokeWidth={2.5} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function TaskList({ tasks }: { tasks: TaskStatus[] }) {
  if (!tasks.length) {
    return <p className="muted">暂无任务。</p>
  }

  return (
    <div className="task-list">
      {tasks.map((task) => (
        <div className="task-item" key={task.task_id}>
          <div className="task-head">
            <span>{statusIcon(task.status)}</span>
            <strong>{task.name}</strong>
            <em>{task.status}</em>
          </div>
          <div className="progress-line">
            <i style={{ width: `${Math.max(0, Math.min(task.progress ?? 0, 100))}%` }} />
          </div>
          <p>{task.progress_msg || task.error || task.task_id}</p>
        </div>
      ))}
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

function AccountRow({ account }: { account: AccountApiRow }) {
  return (
    <div className="account-row">
      <div>
        <strong>{account.account_name}</strong>
        <span>{strategyLabels[account.strategy_name]} · started {formatDate(account.started_at)}</span>
      </div>
      <div>
        <b>{cnMoney(account.current_equity)}</b>
        <em className={toneFromNumber(account.return_pct)}>{signedPct(account.return_pct)}</em>
      </div>
    </div>
  )
}

function titleFor(view: View) {
  return {
    dashboard: '系统总览',
    screen: '多因子选股',
    rating: '单股评级',
    paper: '模拟盘',
    backtest: '回测表现',
  }[view]
}

function errorMessage(err: unknown) {
  if (err instanceof ApiError) {
    return `${err.message}${err.code ? ` (${err.code})` : ''}`
  }
  if (err instanceof Error) {
    return err.message
  }
  return '未知错误'
}

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function upsertTask(tasks: TaskStatus[], task: TaskStatus) {
  const next = [task, ...tasks.filter((item) => item.task_id !== task.task_id)]
  return next.slice(0, 8)
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
