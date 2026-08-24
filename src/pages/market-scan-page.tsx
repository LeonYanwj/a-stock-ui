import { useState } from 'react'
import { AlertTriangle, CheckCircle2, ChevronRight, Clock3, LoaderCircle, ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { MarketScanSubmitParams } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { AssetType, MarketScanCandidate, MarketScanTask, StockScanScope, Strategy } from '@/types'

type Notice = { type: 'success' | 'error'; title: string; detail?: string }
const scanWindows: Array<'pre_market' | 'midday'> = ['pre_market', 'midday']

export function MarketScanPage({ scanTask, scanTasks, onGenerate, onSelectScan, onNotify }: {
  scanTask: MarketScanTask | null
  scanTasks: MarketScanTask[]
  onGenerate: (params: MarketScanSubmitParams) => Promise<void>
  onSelectScan: (taskId: string) => Promise<void>
  onNotify: (notice: Notice) => void
}) {
  const [strategy, setStrategy] = useState<Extract<Strategy, 'short_term' | 'medium_term' | 'long_term'>>('medium_term')
  const [assetTypes, setAssetTypes] = useState<AssetType[]>(['stock', 'etf'])
  const [planWindow, setPlanWindow] = useState<'pre_market' | 'midday'>('pre_market')
  const [stockScope, setStockScope] = useState<StockScanScope>('quick')
  const [busy, setBusy] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const selectedWindow = scanWindows.includes(planWindow) ? planWindow : 'pre_market'

  const submit = async () => {
    setBusy(true)
    try {
      await onGenerate({ strategyCode: strategy, assetTypes, planWindow: selectedWindow, stockScope, quickLimit: 100 })
      onNotify({ type: 'success', title: '市场扫描已提交', detail: assetTypes.includes('stock') && stockScope === 'quick' ? '将按最新成交额扫描前 100 只高流动性股票。' : '扫描任务已创建，正在后台执行。' })
    } catch (reason) {
      onNotify({ type: 'error', title: '市场扫描提交失败', detail: reason instanceof Error ? reason.message : '请检查服务后重试。' })
    } finally { setBusy(false) }
  }

  const openDetail = async (taskId: string) => {
    try {
      await onSelectScan(taskId)
      setDetailOpen(true)
    } catch (reason) {
      onNotify({ type: 'error', title: '读取扫描详情失败', detail: reason instanceof Error ? reason.message : '请稍后重试。' })
    }
  }

  return <div className="space-y-6">
    <section className="work-surface scan-hero overflow-hidden p-6 sm:p-8">
      <div className="relative z-10 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <select value={strategy} onChange={event => setStrategy(event.target.value as typeof strategy)} className="h-10 rounded-xl border border-[#E9E5F2] bg-white px-3 text-sm outline-none focus:border-[#F1846D]" aria-label="选择扫描策略">
              <option value="short_term">短线策略</option><option value="medium_term">中线策略</option><option value="long_term">长线策略</option>
            </select>
            <span className="text-xs text-[#9490A5]">资产范围</span>
            {(['stock', 'etf'] as AssetType[]).map(type => <label key={type} className="inline-flex h-10 items-center gap-2 rounded-xl border border-[#E9E5F2] bg-white px-3 text-sm"><input type="checkbox" checked={assetTypes.includes(type)} onChange={() => toggleAssetType(type, assetTypes, setAssetTypes)} />{assetLabel(type)}</label>)}
            {assetTypes.includes('stock') && <select value={stockScope} onChange={event => setStockScope(event.target.value as StockScanScope)} className="h-10 rounded-xl border border-[#E9E5F2] bg-white px-3 text-sm outline-none focus:border-[#F1846D]" aria-label="选择股票扫描范围"><option value="quick">快速扫描（高流动性前 100 只）</option><option value="full">全市场扫描（耗时较长）</option></select>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={selectedWindow} onChange={event => setPlanWindow(event.target.value as 'pre_market' | 'midday')} className="h-10 rounded-xl border border-[#E9E5F2] bg-white px-3 text-sm outline-none focus:border-[#F1846D]" aria-label="选择扫描时段">
            {scanWindows.map(scanWindow => <option key={scanWindow} value={scanWindow}>{windowLabel(scanWindow)}</option>)}
          </select>
          <Button className="h-10 rounded-xl bg-[#F1846D] text-white hover:bg-[#E5745E]" disabled={!assetTypes.length || busy} onClick={() => void submit()}>{busy ? <LoaderCircle className="animate-spin" /> : <ScanSearch />}{busy ? '正在创建扫描记录…' : '开始市场扫描'}</Button>
        </div>
      </div>
    </section>

    <section className="work-surface p-6">
      <div className="flex items-center gap-2"><Clock3 className="size-5 text-[#D96651]" /><p className="text-xs font-semibold tracking-[.14em] text-[#D96651]">扫描记录</p></div>
      <div className="mt-5 space-y-3">{scanTasks.map(task => <ScanRecord key={task.task_id} task={task} selected={scanTask?.task_id === task.task_id} onClick={() => void openDetail(task.task_id)} />)}{!scanTasks.length && <Empty text="暂无扫描记录。" />}</div>
    </section>
    {detailOpen && scanTask && <ScanDetailModal task={scanTask} onClose={() => setDetailOpen(false)} />}
  </div>
}

function ScanDetailModal({ task, onClose }: { task: MarketScanTask; onClose: () => void }) {
  const result = task.status === 'done' ? task.result : undefined
  const candidates = result?.candidates ?? []
  const eligible = candidates.filter(candidate => candidate.candidate_status === 'eligible')
  const blocked = candidates.filter(candidate => candidate.candidate_status === 'blocked')
  const dataAsOf = result?.as_of ?? task.params?.as_of
  return <div className="fixed inset-0 z-[90] flex items-end bg-[#312C46]/30 p-0 backdrop-blur-[2px] sm:items-center sm:justify-center sm:p-6" role="dialog" aria-modal="true" aria-label="扫描详情">
    <div className="max-h-[92svh] w-full overflow-y-auto rounded-t-[28px] bg-white shadow-[0_24px_80px_rgba(49,44,70,.24)] sm:max-w-5xl sm:rounded-[28px]">
      <div className="sticky top-0 z-10 flex items-start justify-between border-b border-[#F0EDF6] bg-white px-6 py-5"><div><p className="text-xs font-semibold tracking-[.14em] text-[#D96651]">扫描详情</p><h3 className="mt-1 text-lg font-bold">{windowLabel(task.params?.plan_window)} · {statusLabel(task.status)}</h3><p className="mt-1 text-sm text-[#9490A5]">创建于 {formatDate(task.created_at)}</p></div><button type="button" onClick={onClose} className="grid size-9 place-items-center rounded-xl text-xl text-[#706B80] hover:bg-[#F4F1F8]" aria-label="关闭扫描详情">×</button></div>
      <div className="space-y-6 p-6">
        <TaskMetadata task={task} dataAsOf={dataAsOf} />
        {(task.status === 'pending' || task.status === 'running') && <ProgressPanel task={task} />}
        {task.status === 'failed' && <Failure task={task} />}
        {task.status === 'done' && result && <>
          <div className="rounded-xl bg-[#F4FCF7] p-4"><div className="flex items-center gap-2 text-sm font-medium text-[#3E9677]"><CheckCircle2 className="size-5" />扫描已完成</div><p className="mt-2 text-sm leading-6 text-[#706B80]">{result.message}</p><p className="mt-2 text-xs text-[#9490A5]">数据截面：{formatDate(result.as_of)} · 共返回 {result.candidate_count} 条候选</p></div>
          <section className="overflow-hidden rounded-2xl border border-[#F0EDF6]"><div className="p-5"><p className="text-xs font-semibold tracking-[.14em] text-[#D96651]">候选结果</p><h4 className="mt-1.5 text-lg font-bold">本次扫描结果</h4></div><CandidateTable candidates={eligible} empty={result.candidate_count === 0 ? '本次扫描已完成，但没有符合条件的候选。' : '本次扫描没有可研究候选，请查看下方阻止原因。'} /></section>
          <section><p className="text-xs font-semibold tracking-[.14em] text-[#D96651]">淘汰与阻止</p><h4 className="mt-1.5 text-lg font-bold">需要处理的原因</h4><div className="mt-4 space-y-3">{blocked.map(candidate => <div className="flex gap-3 rounded-xl bg-[#FFF6F3] p-4" key={`${candidate.ts_code}-${candidate.data_as_of}`}><AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#D95F55]" /><div><p className="font-mono text-sm font-semibold">{candidate.ts_code}</p><p className="mt-1 text-sm leading-6 text-[#9A4F48]">{candidate.blocked_reason || '此标的被数据状态或风控阻止，后端暂未提供更具体的恢复建议。'}</p></div></div>)}{!blocked.length && <Empty text="本次扫描没有接口返回的阻止项。" />}</div></section>
        </>}
      </div>
    </div>
  </div>
}

function TaskMetadata({ task, dataAsOf }: { task: MarketScanTask; dataAsOf?: string | null }) {
  return <dl className="grid gap-3 rounded-2xl bg-[#FAF9FF] p-4 text-sm sm:grid-cols-2 lg:grid-cols-3">
    <Meta label="任务 ID" value={task.task_id} mono /><Meta label="策略" value={strategyLabel(task.params?.strategy_code)} /><Meta label="扫描范围" value={assetTypesLabel(task.params?.asset_types)} /><Meta label="股票覆盖" value={stockScopeLabel(task.params?.asset_types, task.params?.stock_scope, task.params?.quick_limit)} /><Meta label="扫描时段" value={windowLabel(task.params?.plan_window)} /><Meta label="数据截面" value={formatDate(dataAsOf)} /><Meta label="当前状态" value={statusLabel(task.status)} />
  </dl>
}

function Meta({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) { return <div className="min-w-0"><dt className="text-[11px] text-[#9490A5]">{label}</dt><dd className={cn('mt-1 truncate text-sm font-medium', mono && 'font-mono')}>{value}</dd></div> }

function ScanRecord({ task, selected, onClick }: { task: MarketScanTask; selected: boolean; onClick: () => void }) {
  const active = task.status === 'pending' || task.status === 'running'
  return <button type="button" onClick={onClick} aria-pressed={selected} className={cn('block w-full rounded-xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[#F1846D]', selected ? 'border-[#F1846D] bg-[#FFF8F6]' : 'border-[#ECE8F4] bg-white hover:border-[#D9D1E8] hover:bg-[#FCFBFF]')}><div className="flex items-start gap-3"><span className={cn('mt-1 size-2.5 shrink-0 rounded-full', task.status === 'done' ? 'bg-[#6CCBA7]' : task.status === 'failed' ? 'bg-[#D95F55]' : 'bg-[#F6BD4F]')} /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="font-medium">{windowLabel(task.params?.plan_window)}</span><span className="text-sm text-[#706B80]">{statusLabel(task.status)}</span><span className="text-xs text-[#9490A5]">{formatDate(task.created_at)}</span></div><p className="mt-1 font-mono text-xs text-[#9490A5]">任务 {shortTaskId(task.task_id)} · {strategyLabel(task.params?.strategy_code)} · {assetTypesLabel(task.params?.asset_types)} · {stockScopeLabel(task.params?.asset_types, task.params?.stock_scope, task.params?.quick_limit)}</p><p className="mt-1 truncate text-sm text-[#9490A5]">{task.status === 'failed' ? task.error || '扫描失败，后端未提供原因。' : task.progress_msg || (task.status === 'done' ? '扫描完成，点击查看候选详情。' : '正在等待后端处理。')}</p>{active && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F1EFF7]"><div className="h-full rounded-full bg-[#F1846D] transition-all" style={{ width: `${Math.max(4, task.progress)}%` }} /></div>}</div><ChevronRight className="mt-1 size-5 shrink-0 text-[#A39DB2]" /></div></button>
}

function ProgressPanel({ task }: { task: MarketScanTask }) {
  const events = task.progress_events ?? []
  return <div className="mt-5"><div className="flex items-center gap-3"><LoaderCircle className="size-5 animate-spin text-[#F1846D]" /><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-3"><h4 className="font-semibold">正在扫描市场</h4><span className="font-mono text-sm text-[#D96651]">{Math.round(task.progress)}%</span></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-[#F1EFF7]"><div className="h-full rounded-full bg-[#F1846D] transition-all" style={{ width: `${Math.max(4, task.progress)}%` }} /></div><p className="mt-2 text-sm text-[#706B80]">{task.progress_msg || '正在准备扫描阶段…'}</p></div></div>{events.length > 0 && <div className="mt-5 grid gap-2 sm:grid-cols-2">{events.slice(-6).map((event, index) => <div className="rounded-xl bg-[#FAF9FF] px-3 py-2 text-xs text-[#706B80]" key={`${event.at ?? index}-${event.progress}`}><span className="mr-2 font-mono text-[#D96651]">{event.progress}%</span>{event.message}</div>)}</div>}</div>
}

function Failure({ task }: { task: MarketScanTask }) { return <div className="mt-5 flex gap-3 rounded-xl bg-[#FFF6F3] p-4"><AlertTriangle className="mt-0.5 size-5 shrink-0 text-[#D95F55]" /><div><h4 className="font-semibold">扫描失败</h4><p className="mt-1 text-sm leading-6 text-[#9A4F48]">{task.error || '后端没有提供失败原因。请检查服务日志或稍后重试。'}</p></div></div> }

function CandidateTable({ candidates, empty }: { candidates: MarketScanCandidate[]; empty: string }) {
  return <><div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left text-sm"><thead className="border-y border-[#F0EDF6] bg-[#FCFBFF] text-xs text-[#9490A5]"><tr><th className="px-6 py-3 font-medium">证券</th><th className="py-3 font-medium">动作</th><th className="py-3 font-medium">入选理由</th><th className="py-3 font-medium">评分</th><th className="py-3 font-medium">参考价 / 区间</th><th className="py-3 font-medium">数据截面</th><th className="px-6 py-3 font-medium">状态</th></tr></thead><tbody>{candidates.map(candidate => <tr key={`${candidate.ts_code}-${candidate.data_as_of ?? candidate.reason}`} className="border-b border-[#F4F1F8]"><td className="px-6 py-4"><p className="font-mono font-semibold">{candidate.ts_code}</p><p className="mt-1 text-xs text-[#9490A5]">名称暂未提供 · {assetLabel(candidate.asset_type)}</p></td><td className={cn('py-4 font-medium', candidate.side === 'buy' ? 'text-[#3E9677]' : 'text-[#D96651]')}>{candidate.side === 'buy' ? '候选买入' : '候选卖出'}</td><td className="max-w-80 py-4 text-[#706B80]">{candidate.reason || '入选理由暂未提供'}</td><td className="py-4 font-mono text-xs">{candidate.score == null ? '—' : candidate.score.toFixed(2)}</td><td className="py-4 font-mono text-xs">{price(candidate.reference_price)}<br /><span className="text-[#9490A5]">{range(candidate)}</span></td><td className="py-4 text-xs text-[#706B80]">{formatDate(candidate.data_as_of)}</td><td className="px-6 py-4"><span className="rounded-full bg-[#EAF9F2] px-2 py-1 text-xs text-[#3E9677]">可研究</span>{candidate.execution_confirmation_required && <p className="mt-1 text-[11px] text-[#876316]">成交前确认券商报价</p>}</td></tr>)}</tbody></table></div>{!candidates.length && <div className="p-6"><Empty text={empty} /></div>}</>
}

function Empty({ text }: { text: string }) { return <div className="rounded-xl border border-dashed border-[#DED9EA] bg-[#FCFBFF] px-5 py-8 text-center text-sm leading-6 text-[#706B80]">{text}</div> }
function formatDate(value: string | null | undefined) { if (!value) return '数据暂未提供'; const parsed = new Date(value); return Number.isNaN(parsed.valueOf()) ? value : parsed.toLocaleString('zh-CN', { hour12: false }) }
function price(value: number | null | undefined) { return typeof value === 'number' ? `¥${value.toFixed(2)}` : '数据暂未提供' }
function range(candidate: MarketScanCandidate) { const item = candidate.suggested_price_range; return item?.min_price != null || item?.max_price != null ? `${price(item.min_price)} — ${price(item.max_price)}` : '价格区间暂未提供' }
function statusLabel(status: MarketScanTask['status']) { return ({ pending: '等待执行', running: '进行中', done: '已完成', failed: '失败' } as const)[status] }
function windowLabel(window: unknown) { return window === 'midday' ? '午间扫描' : '盘前扫描' }
function strategyLabel(strategy: unknown) { return strategy === 'short_term' ? '短线策略' : strategy === 'long_term' ? '长线策略' : strategy === 'medium_term' ? '中线策略' : '策略暂未提供' }
function assetLabel(type: AssetType) { return type === 'etf' ? 'ETF' : '股票' }
function assetTypesLabel(types: unknown) { return Array.isArray(types) && types.length ? types.filter((type): type is AssetType => type === 'stock' || type === 'etf').map(assetLabel).join(' / ') || '范围暂未提供' : '范围暂未提供' }
function stockScopeLabel(types: unknown, scope: unknown, quickLimit: unknown) { if (!Array.isArray(types) || !types.includes('stock')) return '不扫描股票'; if (scope === 'quick') return `快速扫描（前 ${typeof quickLimit === 'number' ? quickLimit : 100} 只）`; return '全市场扫描' }
function shortTaskId(taskId: string) { return taskId.length > 12 ? `${taskId.slice(0, 12)}…` : taskId }
function toggleAssetType(type: AssetType, current: AssetType[], setAssetTypes: (next: AssetType[]) => void) { setAssetTypes(current.includes(type) ? current.filter(item => item !== type) : [...current, type]) }
