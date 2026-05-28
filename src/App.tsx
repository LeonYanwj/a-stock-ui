import { useEffect, useMemo, useRef, useState } from 'react'
import { EmptyState } from '@/components/dashboard/common'
import type { StreamState } from '@/components/dashboard/common'
import { AppShell, type View } from '@/components/layout/app-shell'
import { api, ApiError, type DailyRunParams, type ScreenParams } from '@/lib/api'
import { BacktestPage } from '@/pages/backtest-page'
import { PaperPage } from '@/pages/paper-page'
import { RatingPage } from '@/pages/rating-page'
import type {
  AccountApiRow,
  BacktestApiRun,
  DailyBar,
  EquityApiPoint,
  PositionApiRow,
  RatingApiResponse,
  ScreenApiResult,
  Strategy,
  TaskStatus,
  TradeApiRow,
} from '@/types'

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

const defaultStream: StreamState = { active: false, progress: 0, message: '' }
const defaultStrategies: Strategy[] = ['short_term', 'swing', 'trend', 'ic_optimized']

function App() {
  const [view, setView] = useState<View>('paper')
  const [strategy, setStrategy] = useState<Strategy>('swing')
  const [strategies, setStrategies] = useState<Strategy[]>(defaultStrategies)
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
  const [accountLoading, setAccountLoading] = useState(false)
  const [positionStream, setPositionStream] = useState<StreamState>(defaultStream)
  const [ratingStream, setRatingStream] = useState<StreamState>(defaultStream)
  const positionStreamCloseRef = useRef<(() => void) | null>(null)
  const ratingStreamCloseRef = useRef<(() => void) | null>(null)
  const ratingBusyRef = useRef(false)
  const accountRequestRef = useRef(0)
  const ratingRequestRef = useRef(0)

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
      setStrategies(strategyData.strategies.length ? strategyData.strategies : defaultStrategies)
      setAccounts(accountData)
      setBacktests(backtestData)
      setTasks(taskData)
      if (accountData.length && selectedAccountId === null) {
        const defaultAccount = accountData.find((account) => account.is_active) ?? accountData[0]
        setSelectedAccountId(defaultAccount.account_id)
        setStrategy(defaultAccount.strategy_name)
      }
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoading(false)
    }
  }

  async function refreshAccount(accountId: number) {
    const requestId = accountRequestRef.current + 1
    accountRequestRef.current = requestId
    positionStreamCloseRef.current?.()
    setAccountLoading(true)
    setPositionStream({ active: true, progress: 5, message: '开始同步持仓实时数据' })

    try {
      const [tradeData, curveData, reportData] = await Promise.all([
        api.getTrades(accountId, 50),
        api.getEquityCurve(accountId),
        api.getReport(accountId).catch(() => ({ report: '' })),
      ])
      if (accountRequestRef.current !== requestId) return
      setTrades(tradeData)
      setEquityCurve(curveData)
      setDailyReport(reportData.report)
    } catch (err) {
      if (accountRequestRef.current === requestId) setError(errorMessage(err))
    }

    positionStreamCloseRef.current = api.streamPositions(
      accountId,
      { useRealtime: true },
      {
        onProgress: (progress, message) => {
          if (accountRequestRef.current !== requestId) return
          setPositionStream({ active: true, progress, message })
        },
        onResult: (result) => {
          if (accountRequestRef.current !== requestId) return
          setPositions(result)
          setPositionStream({ active: false, progress: 100, message: '持仓同步完成' })
          setAccountLoading(false)
        },
        onError: (message) => {
          if (accountRequestRef.current !== requestId) return
          setPositionStream({ active: true, progress: 20, message: `${message}，正在切换普通接口` })
          api
            .getPositions(accountId, true)
            .then((result) => {
              if (accountRequestRef.current !== requestId) return
              setPositions(result)
              setPositionStream({ active: false, progress: 100, message: '持仓同步完成' })
            })
            .catch((err) => {
              if (accountRequestRef.current === requestId) {
                setError(errorMessage(err))
                setPositionStream({ active: false, progress: 0, message: '', error: message })
              }
            })
            .finally(() => {
              if (accountRequestRef.current === requestId) setAccountLoading(false)
            })
        },
      },
    )
  }

  async function runRating(code: string, ratingStrategy = strategy, noFlow = false, noNews = false) {
    const normalized = code.trim()
    if (!normalized) return
    if (ratingBusyRef.current) return
    ratingBusyRef.current = true
    const requestId = ratingRequestRef.current + 1
    ratingRequestRef.current = requestId
    ratingStreamCloseRef.current?.()
    setError('')
    setView('rating')
    setSelectedRatingCode(normalized)
    setRatingStream({ active: true, progress: 3, message: '解析股票代码' })
    setDailyBars([])

    api.getDailyBars(normalized, 90).then((bars) => {
      if (ratingRequestRef.current === requestId) setDailyBars(bars)
    }).catch(() => {
      if (ratingRequestRef.current === requestId) setDailyBars([])
    })

    ratingStreamCloseRef.current = api.streamRating(
      normalized,
      { strategy: ratingStrategy, noFlow, noNews },
      {
        onProgress: (progress, message) => {
          if (ratingRequestRef.current !== requestId) return
          setRatingStream({ active: true, progress, message })
        },
        onResult: (result) => {
          if (ratingRequestRef.current !== requestId) return
          setRating(result)
          setRatingStream({ active: false, progress: 100, message: '评级完成' })
          ratingBusyRef.current = false
        },
        onError: (message) => {
          if (ratingRequestRef.current !== requestId) return
          setRatingStream({ active: true, progress: 20, message: `${message}，正在切换普通接口` })
          api
            .getRating(normalized, ratingStrategy, noFlow, noNews)
            .then((result) => {
              if (ratingRequestRef.current !== requestId) return
              setRating(result)
              setRatingStream({ active: false, progress: 100, message: '评级完成' })
              ratingBusyRef.current = false
            })
            .catch((err) => {
              if (ratingRequestRef.current === requestId) {
                setError(errorMessage(err))
                setRatingStream({ active: false, progress: 0, message: '', error: message })
                ratingBusyRef.current = false
              }
            })
        },
      },
    )
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

  useEffect(() => {
    if (view !== 'rating') {
      ratingStreamCloseRef.current?.()
      ratingBusyRef.current = false
      setRatingStream((prev) => ({ ...prev, active: false }))
    }
  }, [view])

  useEffect(() => () => {
    positionStreamCloseRef.current?.()
    ratingStreamCloseRef.current?.()
  }, [])

  const pageTitle = {
    paper: '模拟盘复盘',
    rating: '持仓评级',
    backtest: '回测表现',
  }[view]

  const pageSubtitle = {
    paper: '账户、权益、持仓和调仓任务的一日复盘',
    rating: '以当前持仓为上下文解释总评级、五维评分和走势',
    backtest: '按最近回测比较策略收益、回撤、Sharpe 和胜率',
  }[view]

  return (
    <AppShell
      apiBaseUrl={api.baseUrl}
      health={health}
      onRefresh={refreshBase}
      onViewChange={setView}
      selectedAccount={selectedAccount}
      strategy={strategy}
      subtitle={pageSubtitle}
      title={pageTitle}
      view={view}
    >
      {error && <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {loading ? (
        <EmptyState description="正在读取账户、策略、任务和回测记录。" title="正在连接后端 API" />
      ) : (
        <>
          {view === 'paper' && selectedAccount && (
            <PaperPage
              accountLoading={accountLoading}
              accounts={accounts}
              dailyReport={dailyReport}
              equityCurve={equityCurve}
              onAutoRebalance={(limit, enableNews) =>
                trackTask<AutoRebalanceResult>(
                  () => api.runAutoRebalanceAsync(selectedAccount.account_id, limit, enableNews),
                  undefined,
                  3000,
                )
              }
              onDailyRun={(params: DailyRunParams) =>
                trackTask<DailyRunResult>(() => api.runDailyAsync(selectedAccount.account_id, params), undefined, 3000)
              }
              onRatePosition={(code) => runRating(code, selectedAccount.strategy_name)}
              onRefresh={() => refreshAccount(selectedAccount.account_id).catch((err) => setError(errorMessage(err)))}
              onSelectAccount={setSelectedAccountId}
              onSnapshot={() =>
                api
                  .saveSnapshot(selectedAccount.account_id)
                  .then(() => refreshAccount(selectedAccount.account_id))
                  .catch((err) => setError(errorMessage(err)))
              }
              onStoploss={() =>
                api
                  .triggerStoploss(selectedAccount.account_id)
                  .then(() => refreshAccount(selectedAccount.account_id))
                  .catch((err) => setError(errorMessage(err)))
              }
              positionStream={positionStream}
              positions={positions}
              selectedAccount={selectedAccount}
              tasks={tasks}
              trades={trades}
            />
          )}
          {view === 'paper' && !selectedAccount && <EmptyState title="后端暂无模拟账户" />}
          {view === 'rating' && (
            <RatingPage
              dailyBars={dailyBars}
              onRun={runRating}
              onRunScreen={(params: ScreenParams) =>
                trackTask<ScreenApiResult>(
                  () => api.runScreenAsync(params),
                  (result) => setScreenResult(result),
                  2500,
                )
              }
              onStrategyChange={setStrategy}
              positions={positions}
              rating={rating}
              ratingStream={ratingStream}
              screenResult={screenResult}
              selectedAccount={selectedAccount}
              selectedCode={selectedRatingCode}
              strategies={strategies}
              strategy={strategy}
            />
          )}
          {view === 'backtest' && (
            <BacktestPage
              onRun={(params) =>
                trackTask(
                  () => api.runBacktestAsync(params),
                  () => api.getBacktests(undefined, 30).then(setBacktests),
                  10000,
                )
              }
              onStrategyChange={setStrategy}
              runs={backtests}
              strategies={strategies}
              strategy={strategy}
              tasks={tasks}
            />
          )}
        </>
      )}
    </AppShell>
  )
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

export default App
