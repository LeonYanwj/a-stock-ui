import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { AppShell, type View } from '@/components/layout/app-shell'
import { api, ApiError, onUnauthorized, type MarketScanSubmitParams, type RecordTradeRunFillParams } from '@/lib/api'
import { MarketScanPage } from '@/pages/market-scan-page'
import { TradeWorkbenchPage } from '@/pages/trade-workbench-page'
import type { MarketScanTask, SystemDataStatus, TradeRun, TradeRunDetailDashboard, TradeRunEvent, TradeRunPerformance, TradeRunPlan, TradeRunPosition } from '@/types'

type NoticeInput = { type: 'success' | 'error'; title: string; detail?: string }
type Notice = NoticeInput & { id: number; phase: 'entering' | 'visible' | 'leaving' }

function LoginPage({ onLogin, error }: { onLogin: (username: string, password: string) => Promise<void>; error: string }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    setBusy(true)
    try { await onLogin(username, password) } finally { setBusy(false) }
  }
  return <div className="grid min-h-svh place-items-center bg-[#F8F7FF] p-5 text-[#312C46]"><div className="w-full max-w-md rounded-[28px] bg-white p-8 shadow-[0_20px_60px_rgba(62,47,111,.10)]"><div className="grid size-12 place-items-center rounded-2xl bg-[#F1846D] text-xl text-white shadow-[0_10px_20px_rgba(241,132,109,.25)]">✦</div><p className="mt-7 text-sm text-[#9490A5]">人工执行工作台</p><h1 className="mt-1 text-2xl font-bold">进入今日交易</h1><p className="mt-3 text-sm leading-6 text-[#706B80]">使用管理员用户名和密码建立安全会话。</p><label className="mt-7 block text-sm font-medium">用户名<input autoFocus autoComplete="username" className="mt-2 h-11 w-full rounded-xl border border-[#E9E5F2] bg-[#FDFCFF] px-3 outline-none focus:border-[#F1846D]" value={username} onChange={event => setUsername(event.target.value)} onKeyDown={event => event.key === 'Enter' && username && password && void submit()} placeholder="管理员用户名" /></label><label className="mt-4 block text-sm font-medium">密码<input autoComplete="current-password" className="mt-2 h-11 w-full rounded-xl border border-[#E9E5F2] bg-[#FDFCFF] px-3 outline-none focus:border-[#F1846D]" type="password" value={password} onChange={event => setPassword(event.target.value)} onKeyDown={event => event.key === 'Enter' && username && password && void submit()} placeholder="管理员密码" /></label>{error && <p className="mt-3 rounded-xl bg-[#FFF0EC] px-3 py-2 text-sm text-[#B4534C]">{error}</p>}<button className="mt-6 h-11 w-full rounded-xl bg-[#F1846D] font-medium text-white shadow-[0_10px_18px_rgba(241,132,109,.22)] transition hover:bg-[#E5745E] disabled:opacity-50" disabled={busy || !username || !password} onClick={() => void submit()}>{busy ? '正在验证…' : '进入工作台'}</button></div></div>
}

function App() {
  const [authenticated, setAuthenticated] = useState<boolean | null>(null)
  const [authError, setAuthError] = useState('')
  const [view, setView] = useState<View>('overview')
  const [runs, setRuns] = useState<TradeRun[]>([])
  const [selectedRunId, setSelectedRunId] = useState<number | null>(null)
  const [dataStatus, setDataStatus] = useState<SystemDataStatus | null>(null)
  const [dashboard, setDashboard] = useState<TradeRunDetailDashboard | null>(null)
  const [plans, setPlans] = useState<TradeRunPlan[]>([])
  const [positions, setPositions] = useState<TradeRunPosition[]>([])
  const [performance, setPerformance] = useState<TradeRunPerformance | null>(null)
  const [events, setEvents] = useState<TradeRunEvent[]>([])
  const [scanTasks, setScanTasks] = useState<MarketScanTask[]>([])
  const [scanTask, setScanTask] = useState<MarketScanTask | null>(null)
  const [health, setHealth] = useState<{ status: string; db: string } | null>(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState<Notice | null>(null)
  const noticeEnterTimer = useRef<number | null>(null)
  const noticeTimer = useRef<number | null>(null)
  const noticeExitTimer = useRef<number | null>(null)
  const failedScanTaskIds = useRef(new Set<string>())
  const pollingMarketScanTaskIds = useRef(new Set<string>())
  const selectedRun = useMemo(() => runs.find(run => run.run_id === selectedRunId) ?? runs[0] ?? null, [runs, selectedRunId])

  const dismissNotice = useCallback(() => {
    if (noticeEnterTimer.current !== null) window.clearTimeout(noticeEnterTimer.current)
    noticeEnterTimer.current = null
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    noticeTimer.current = null
    setNotice(current => current && current.phase !== 'leaving' ? { ...current, phase: 'leaving' } : current)
    if (noticeExitTimer.current !== null) window.clearTimeout(noticeExitTimer.current)
    noticeExitTimer.current = window.setTimeout(() => setNotice(current => current?.phase === 'leaving' ? null : current), 220)
  }, [])
  const notify = useCallback((next: NoticeInput) => {
    if (noticeEnterTimer.current !== null) window.clearTimeout(noticeEnterTimer.current)
    if (noticeTimer.current !== null) window.clearTimeout(noticeTimer.current)
    if (noticeExitTimer.current !== null) window.clearTimeout(noticeExitTimer.current)
    const id = Date.now()
    setNotice({ ...next, id, phase: 'entering' })
    noticeEnterTimer.current = window.setTimeout(() => setNotice(current => current?.id === id ? { ...current, phase: 'visible' } : current), 220)
    noticeTimer.current = window.setTimeout(dismissNotice, 4200)
  }, [dismissNotice])

  const refreshRun = useCallback(async (id: number) => {
    try {
      const [run, detail, nextPlans, nextPositions, nextPerformance, nextEvents] = await Promise.all([api.getTradeRun(id), api.getTradeRunDashboard(id), api.getTradeRunPlans(id), api.getTradeRunPositions(id), api.getTradeRunPerformance(id), api.getTradeRunEvents(id)])
      setRuns(current => current.map(item => item.run_id === run.run_id ? run : item))
      setDashboard(detail); setPlans(nextPlans); setPositions(nextPositions); setPerformance(nextPerformance); setEvents(nextEvents)
    } catch (reason) { setError(errorMessage(reason)) }
  }, [])
  const refreshScanTasks = useCallback(async () => {
    const tasks = await api.getMarketScanTasks()
    setScanTasks(tasks)
    setScanTask(current => current && tasks.some(task => task.task_id === current.task_id) ? current : tasks[0] ?? null)
  }, [])
  const refresh = useCallback(async (notifyOnComplete = false) => {
    setError('')
    try { setHealth(await api.health()) } catch (reason) { setHealth(null); const message = errorMessage(reason); if (notifyOnComplete) notify({ type: 'error', title: '刷新数据失败', detail: message }); else setError(message); return false }
    try {
      const [summary, systemStatus, nextScanTasks] = await Promise.all([api.getTradeRunsDashboard(), api.getSystemDataStatus(), api.getMarketScanTasks()])
      setRuns(summary.runs); setDataStatus(systemStatus); setScanTasks(nextScanTasks); setScanTask(nextScanTasks[0] ?? null)
      setSelectedRunId(current => summary.runs.some(run => run.run_id === current) ? current : summary.runs[0]?.run_id ?? null)
      if (notifyOnComplete) notify({ type: 'success', title: '数据已刷新', detail: '已更新交易、扫描记录和系统数据状态。' })
      return true
    } catch (reason) { if (!(reason instanceof ApiError && reason.status === 401)) { const message = errorMessage(reason); if (notifyOnComplete) notify({ type: 'error', title: '刷新数据失败', detail: message }); else setError(message) }; return false }
  }, [notify])
  useEffect(() => { api.getSession().then(session => { setAuthenticated(session.authenticated); if (session.authenticated) void refresh() }).catch(() => setAuthenticated(false)) }, [refresh])
  useEffect(() => onUnauthorized(() => { setAuthenticated(false); setRuns([]); setDashboard(null); setPlans([]); setPositions([]); setScanTasks([]); setScanTask(null) }), [])
  useEffect(() => { if (selectedRun?.run_id) void refreshRun(selectedRun.run_id); else { setDashboard(null); setPlans([]); setPositions([]); setPerformance(null); setEvents([]) } }, [selectedRun?.run_id, refreshRun])
  const startRun = async (id: number) => {
    try {
      await api.startTradeRun(id)
      await refresh()
      await refreshRun(id)
      notify({ type: 'success', title: '交易已启动', detail: '已启动本次交易，并同步更新当前数据。' })
    } catch (reason) { notify({ type: 'error', title: '启动交易失败', detail: errorMessage(reason) }) }
  }
  const generate = async (params: MarketScanSubmitParams) => {
    try {
      const submitted = await api.submitMarketScan(params)
      setScanTask(submitted.task)
      setScanTasks(previous => [submitted.task, ...previous.filter(task => task.task_id !== submitted.task.task_id)])
      void pollMarketScan(submitted.task_id)
    } catch (reason) { throw new Error(marketScanErrorMessage(reason)) }
  }
  const pollMarketScan = useCallback(async (taskId: string) => {
    if (pollingMarketScanTaskIds.current.has(taskId)) return
    pollingMarketScanTaskIds.current.add(taskId)
    try {
      for (;;) {
        await wait(1000)
        try {
          const task = await api.getMarketScanTask(taskId)
          setScanTask(current => current?.task_id === taskId ? task : current)
          setScanTasks(previous => [task, ...previous.filter(item => item.task_id !== task.task_id)])
          if (task.status === 'failed' && !failedScanTaskIds.current.has(task.task_id)) {
            failedScanTaskIds.current.add(task.task_id)
            notify({ type: 'error', title: '市场扫描失败', detail: task.error || '后端未提供失败原因。' })
          }
          if (task.status !== 'pending' && task.status !== 'running') return
        } catch (reason) {
          if (isMissingMarketScanTask(reason)) {
            await refreshScanTasks().catch(() => undefined)
            notify({ type: 'error', title: '扫描任务不存在', detail: '该任务可能已被清理，扫描记录已刷新。' })
          } else {
            notify({ type: 'error', title: '读取扫描进度失败', detail: marketScanErrorMessage(reason) })
          }
          return
        }
      }
    } finally { pollingMarketScanTaskIds.current.delete(taskId) }
  }, [notify, refreshScanTasks])
  useEffect(() => {
    scanTasks.filter(task => task.status === 'pending' || task.status === 'running').forEach(task => { void pollMarketScan(task.task_id) })
  }, [pollMarketScan, scanTasks])
  const selectScan = async (taskId: string) => {
    try {
      const task = await api.getMarketScanTask(taskId)
      setScanTask(task)
      setScanTasks(previous => [task, ...previous.filter(item => item.task_id !== task.task_id)])
    } catch (reason) {
      if (isMissingMarketScanTask(reason)) await refreshScanTasks().catch(() => undefined)
      throw new Error(marketScanErrorMessage(reason))
    }
  }
  const fill = async (params: RecordTradeRunFillParams) => {
    if (!selectedRun) throw new Error('请先选择本次交易。')
    try {
      await api.recordTradeRunFill(selectedRun.run_id, params)
      await refreshRun(selectedRun.run_id)
      notify({ type: 'success', title: '真实成交已保存', detail: '持仓、成本和交易摘要已同步更新。' })
    } catch (reason) {
      const message = errorMessage(reason)
      notify({ type: 'error', title: '保存真实成交失败', detail: message })
      throw new Error(message)
    }
  }
  const login = async (username: string, password: string) => { try { setAuthError(''); await api.login(username, password); setAuthenticated(true); await refresh() } catch (reason) { setAuthError(errorMessage(reason)) } }
  if (authenticated === null) return <div className="grid min-h-svh place-items-center bg-[#F8F7FF] text-sm text-[#9490A5]">正在验证安全会话…</div>
  if (!authenticated) return <LoginPage onLogin={login} error={authError} />
  const titles: Record<View, [string, string]> = { overview: ['概览', '从启动到复盘，清楚掌握今天的每一步。'], workbench: ['当前交易', '查看计划、在华泰下单，并回填真实成交。'], scan: ['市场扫描', '查看候选池、数据截面与每个判断的原因。'], records: ['持仓与记录', '只展示由真实成交派生的持仓和动作。'], rules: ['交易规则', '确认人工执行边界与数据使用原则。'], settings: ['设置', '查看当前服务和数据状态。'], runs: ['当前交易', '查看计划、在华泰下单，并回填真实成交。'], plans: ['当前交易', '查看计划、在华泰下单，并回填真实成交。'], fills: ['当前交易', '查看计划、在华泰下单，并回填真实成交。'], performance: ['持仓与记录', '只展示由真实成交派生的持仓和动作。'], comparison: ['市场扫描', '查看候选池、数据截面与每个判断的原因。'], etfs: ['市场扫描', '查看候选池、数据截面与每个判断的原因。'], audit: ['持仓与记录', '只展示由真实成交派生的持仓和动作。'] }
  const workbenchMode = (['overview', 'workbench', 'records', 'rules', 'settings'] as const).includes(view as 'overview' | 'workbench' | 'records' | 'rules' | 'settings') ? view as 'overview' | 'workbench' | 'records' | 'rules' | 'settings' : 'workbench'
  return <AppShell view={view} onViewChange={setView} title={titles[view][0]} subtitle={titles[view][1]} health={health} runs={runs} selectedRun={selectedRun ?? undefined} onRunChange={setSelectedRunId} dataStatus={dataStatus} onRefresh={() => void refresh(true)} onLogout={async () => { await api.logout(); setAuthenticated(false) }}><>{notice && <AppNotice notice={notice} onClose={dismissNotice} />}{error && <div className="mb-5 rounded-xl bg-[#FFF0EC] px-4 py-3 text-sm text-[#B4534C]">{error}</div>}{view === 'scan' ? <MarketScanPage scanTask={scanTask} scanTasks={scanTasks} onGenerate={generate} onSelectScan={selectScan} onNotify={notify} /> : <TradeWorkbenchPage mode={workbenchMode} run={selectedRun} dashboard={dashboard} plans={plans} positions={positions} performance={performance} events={events} dataStatus={dataStatus} onStart={startRun} onFill={fill} />}</></AppShell>
}

function AppNotice({ notice, onClose }: { notice: Notice; onClose: () => void }) {
  const success = notice.type === 'success'
  return <div className={`app-notice app-notice--${notice.phase} fixed right-5 top-5 z-[100] flex w-[min(24rem,calc(100vw-2.5rem))] gap-3 rounded-2xl border p-4 shadow-[0_18px_50px_rgba(49,44,70,.18)] ${success ? 'border-[#C8EBD9] bg-white text-[#286E55]' : 'border-[#F3CCC5] bg-white text-[#A94740]'}`} role="status" aria-live="polite"><div className={`grid size-8 shrink-0 place-items-center rounded-full ${success ? 'bg-[#EAF9F2]' : 'bg-[#FFF0EC]'}`}>{success ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}</div><div className="min-w-0 flex-1"><p className="font-semibold">{notice.title}</p>{notice.detail && <p className="mt-1 text-sm leading-5 text-[#706B80]">{notice.detail}</p>}</div><button type="button" onClick={onClose} className="-mt-1 text-lg leading-none text-[#9490A5] hover:text-[#312C46]" aria-label="关闭提示">×</button></div>
}

function wait(ms: number) { return new Promise<void>(resolve => window.setTimeout(resolve, ms)) }

function errorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return '用户名或密码不正确，请核对后重新登录。'
    if (error.status >= 500) return error.message || '后端服务暂时不可用，请稍后重试或联系管理员。'
    return error.message || '请求失败，请稍后重试。'
  }
  if (error instanceof Error && /failed to fetch/i.test(error.message)) {
    return '无法连接后端服务。请确认分析服务已启动，并检查前端代理地址是否正确。'
  }
  return '请求失败，请稍后重试或检查服务连接。'
}

function isMissingMarketScanTask(error: unknown) {
  return error instanceof ApiError && error.status === 404 && error.code === 'MARKET_SCAN_TASK_NOT_FOUND'
}

function marketScanErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code === 'UNKNOWN_STRATEGY') return '策略无效，请重新选择策略后提交。'
    if (error.code === 'INVALID_ASSET_TYPES') return '请至少选择“股票”或“ETF”之一。'
    if (error.code === 'INVALID_PLAN_WINDOW') return '扫描时段无效，请重新选择盘前或午间扫描。'
    if (error.code === 'TRADE_RUN_NOT_CONFIGURED') return '服务端数据连接尚未就绪，请联系管理员检查研究数据服务。'
    if (isMissingMarketScanTask(error)) return '扫描任务不存在，可能已被清理；扫描记录已刷新。'
  }
  return errorMessage(error)
}
export default App
