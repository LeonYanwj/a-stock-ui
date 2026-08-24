import { AlertTriangle, FilePenLine, Pause, Play, Plus, RefreshCw, Trash2, XCircle } from 'lucide-react'
import { useEffect, useState } from 'react'
import { MetricCard, SectionHeader, TableSkeleton, toneClass } from '@/components/dashboard/common'
import { strategyLabels } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cnMoney, fixed, signedPct, toneFromNumber } from '@/lib/format'
import type { RecordTradeRunFillParams } from '@/lib/api'
import type {
  AssetType,
  StrategyDefinition,
  SystemDataStatus,
  TradeRun,
  TradeRunDetailDashboard,
  TradeRunEvent,
  TradeRunPerformance,
  TradeRunPlan,
  TradeRunPosition,
} from '@/types'

export function PaperPage({
  dataStatus,
  events,
  loading,
  onCreateRun,
  onDeleteRun,
  onRecordFill,
  onRefresh,
  onStartRun,
  onStopRun,
  performance,
  plans,
  positions,
  runDashboard,
  runs,
  selectedRun,
  strategyDefinitions,
}: {
  dataStatus: SystemDataStatus | null
  events: TradeRunEvent[]
  loading: boolean
  onCreateRun: (name: string, strategyCode: StrategyDefinition['code'], capital: number, maxPositionPct: number, assetTypes: AssetType[]) => Promise<void>
  onDeleteRun: (runId: number) => Promise<void>
  onRecordFill: (runId: number, params: RecordTradeRunFillParams) => Promise<void>
  onRefresh: () => void
  onStartRun: (runId: number) => Promise<void>
  onStopRun: (runId: number, action: 'pause' | 'end', reason: string) => Promise<void>
  performance: TradeRunPerformance | null
  plans: TradeRunPlan[]
  positions: TradeRunPosition[]
  runDashboard: TradeRunDetailDashboard | null
  runs: TradeRun[]
  selectedRun: TradeRun | null
  strategyDefinitions: StrategyDefinition[]
}) {
  return (
    <Tabs className="space-y-5" defaultValue="overview">
      <div className="w-full overflow-x-auto pb-1">
        <TabsList>
          <TabsTrigger value="overview">实例总览</TabsTrigger>
          <TabsTrigger value="plans">执行计划</TabsTrigger>
          <TabsTrigger value="fills">成交回填</TabsTrigger>
          <TabsTrigger value="positions">持仓与绩效</TabsTrigger>
          <TabsTrigger value="audit">审计时间线</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent className="space-y-5" value="overview">
        <CapabilityNotice dataStatus={dataStatus} />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <CreateRunCard definitions={strategyDefinitions} onCreateRun={onCreateRun} />
          <RunLifecycleCard onDeleteRun={onDeleteRun} onStartRun={onStartRun} onStopRun={onStopRun} run={selectedRun} />
        </div>
        <RunOverview dashboard={runDashboard} loading={loading} onRefresh={onRefresh} run={selectedRun} />
        <RunList runs={runs} selectedRun={selectedRun} />
      </TabsContent>

      <TabsContent className="space-y-5" value="plans">
        <PlanTable plans={plans} />
      </TabsContent>

      <TabsContent className="space-y-5" value="fills">
        {selectedRun ? <FillForm plans={plans} run={selectedRun} onRecordFill={onRecordFill} /> : <EmptyRunState />}
      </TabsContent>

      <TabsContent className="space-y-5" value="positions">
        <PerformanceCard performance={performance} />
        <PositionTable positions={positions} loading={loading} />
      </TabsContent>

      <TabsContent className="space-y-5" value="audit">
        <EventTimeline events={events} />
      </TabsContent>
    </Tabs>
  )
}

function CapabilityNotice({ dataStatus }: { dataStatus: SystemDataStatus | null }) {
  return (
    <div className="flex gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
      <AlertTriangle className="mt-0.5 size-5 shrink-0" />
      <div className="min-w-0">
        <p className="font-medium">人工执行模式</p>
        <p className="mt-1 text-sm leading-6">{dataStatus?.message ?? '正在读取数据与券商执行能力声明。'}</p>
        <p className="mt-1 text-xs text-amber-800">行情可靠性：{dataStatus?.quote_reliability ?? 'unknown'}；不会自动向券商提交订单。</p>
      </div>
    </div>
  )
}

function CreateRunCard({ definitions, onCreateRun }: { definitions: StrategyDefinition[]; onCreateRun: PaperPageProps['onCreateRun'] }) {
  const [name, setName] = useState('')
  const [strategyCode, setStrategyCode] = useState<StrategyDefinition['code']>('short_term')
  const [capital, setCapital] = useState(100000)
  const [maxPositionPct, setMaxPositionPct] = useState(0.8)
  const [stock, setStock] = useState(true)
  const [etf, setEtf] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const selectedDefinition = definitions.find((item) => item.code === strategyCode)
  const canSubmit = name.trim() && capital > 0 && maxPositionPct > 0 && maxPositionPct <= 1 && (stock || etf)

  useEffect(() => {
    if (!definitions.length || definitions.some((item) => item.code === strategyCode)) return
    setStrategyCode(definitions[0].code)
  }, [definitions, strategyCode])

  async function submit() {
    if (!canSubmit || submitting) return
    setSubmitting(true)
    try {
      await onCreateRun(name.trim(), strategyCode, capital, maxPositionPct, [stock && 'stock', etf && 'etf'].filter(Boolean) as AssetType[])
      setName('')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader><SectionHeader title="新建交易实例" description="新建后为草稿，需由你明确启动。策略版本、资金和仓位上限会在创建时冻结。" /></CardHeader>
      <CardContent className="grid gap-4">
        <label className="grid gap-2 text-sm"><span className="font-medium">实例名称</span><Input placeholder="例如：2026 年 8 月短线验证" value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="grid gap-2 text-sm"><span className="font-medium">策略</span>
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={strategyCode} onChange={(event) => setStrategyCode(event.target.value as StrategyDefinition['code'])}>
            {(definitions.length ? definitions : fallbackDefinitions).map((item) => <option key={item.code} value={item.code}>{item.name} · v{item.version_no}</option>)}
          </select>
          <span className="text-xs text-muted-foreground">{selectedDefinition?.description ?? '短线、中线和长线交易实例使用独立的策略定义。'}</span>
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberInput label="初始资金（元）" min={1} value={capital} onChange={setCapital} />
          <NumberInput label="总仓位上限（0-1）" max={1} min={0.01} step={0.05} value={maxPositionPct} onChange={setMaxPositionPct} />
        </div>
        <div className="flex flex-wrap gap-5 text-sm"><CheckLabel checked={stock} label="A 股主板" onChange={setStock} /><CheckLabel checked={etf} label="ETF" onChange={setEtf} /></div>
        <Button disabled={!canSubmit || submitting} onClick={submit}>{submitting ? '创建中…' : <><Plus />创建草稿实例</>}</Button>
      </CardContent>
    </Card>
  )
}

function RunLifecycleCard({ run, onStartRun, onStopRun, onDeleteRun }: {
  run: TradeRun | null
  onStartRun: (runId: number) => Promise<void>
  onStopRun: (runId: number, action: 'pause' | 'end', reason: string) => Promise<void>
  onDeleteRun: (runId: number) => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState('用户手动停止执行')
  const [confirmDelete, setConfirmDelete] = useState(false)
  if (!run) return <EmptyRunState />
  const startable = run.status === 'draft' || run.status === 'paused'
  const running = run.status === 'running'

  async function execute(action: () => Promise<void>) {
    if (busy) return
    setBusy(true)
    try { await action() } finally { setBusy(false) }
  }

  return (
    <Card>
      <CardHeader><SectionHeader title="当前实例生命周期" description="只有 running 状态可回填实际成交。结束后不可恢复，删除为逻辑删除且历史永久保留。" /></CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start justify-between gap-4 rounded-md bg-muted/40 p-4">
          <div><p className="font-semibold">{run.name}</p><p className="mt-1 text-sm text-muted-foreground">{strategyLabels[run.strategy_code]} · 创建于 {formatDateTime(run.created_at)}</p></div>
          <RunBadge status={run.status} />
        </div>
        <label className="grid gap-2 text-sm"><span className="font-medium">停止原因</span><Input value={reason} onChange={(event) => setReason(event.target.value)} /></label>
        <div className="flex flex-wrap gap-2">
          {startable && <Button disabled={busy} onClick={() => execute(() => onStartRun(run.run_id))}><Play />启动{run.status === 'paused' ? ' / 恢复' : ''}</Button>}
          {running && <Button disabled={busy} onClick={() => execute(() => onStopRun(run.run_id, 'pause', reason))} variant="outline"><Pause />暂停</Button>}
          {running && <Button disabled={busy} onClick={() => execute(() => onStopRun(run.run_id, 'end', reason))} variant="destructive"><XCircle />结束实例</Button>}
          {!confirmDelete ? <Button disabled={busy} onClick={() => setConfirmDelete(true)} variant="outline"><Trash2 />删除</Button> : <>
            <Button disabled={busy} onClick={() => execute(() => onDeleteRun(run.run_id))} variant="destructive">确认逻辑删除</Button>
            <Button disabled={busy} onClick={() => setConfirmDelete(false)} variant="outline">取消</Button>
          </>}
        </div>
      </CardContent>
    </Card>
  )
}

function RunOverview({ dashboard, loading, run, onRefresh }: { dashboard: TradeRunDetailDashboard | null; loading: boolean; run: TradeRun | null; onRefresh: () => void }) {
  if (!run) return <EmptyRunState />
  if (loading && !dashboard) return <TableSkeleton columns={4} rows={2} />
  const planCount = Object.values(dashboard?.plan_counts ?? {}).reduce((sum, count) => sum + Number(count), 0)
  return <>
    <div className="flex justify-end"><Button onClick={onRefresh} size="sm" variant="outline"><RefreshCw />刷新实例数据</Button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard label="成本口径权益" value={dashboard ? `¥ ${cnMoney(dashboard.total_equity)}` : '-'} helper={`初始资金 ¥ ${cnMoney(run.initial_capital)}`} tone={toneFromNumber((dashboard?.return_pct ?? 0) * 100)} />
      <MetricCard label="可用现金" value={dashboard ? `¥ ${cnMoney(dashboard.cash)}` : '-'} helper={`仓位上限 ${(run.max_position_pct * 100).toFixed(0)}%`} />
      <MetricCard label="持仓成本市值" value={dashboard ? `¥ ${cnMoney(dashboard.market_value)}` : '-'} helper={`估值来源：${dashboard?.market_value_source ?? 'cost'}`} />
      <MetricCard label="计划 / 成交" value={`${planCount} / ${dashboard?.fill_count ?? 0}`} helper={`${dashboard?.positions.length ?? 0} 只当前持仓`} />
    </div>
  </>
}

function RunList({ runs, selectedRun }: { runs: TradeRun[]; selectedRun: TradeRun | null }) {
  return <Card><CardHeader><SectionHeader title="交易实例清单" description="通过页面右上角下拉框切换当前实例。" /></CardHeader><CardContent>
    {runs.length ? <Table><TableHeader><TableRow><TableHead>实例</TableHead><TableHead>策略版本</TableHead><TableHead>状态</TableHead><TableHead>资金 / 上限</TableHead><TableHead>创建时间</TableHead></TableRow></TableHeader><TableBody>{runs.map((run) => <TableRow className={run.run_id === selectedRun?.run_id ? 'bg-muted/40' : ''} key={run.run_id}><TableCell><div className="font-medium">{run.name}</div><div className="text-xs text-muted-foreground">#{run.run_id}</div></TableCell><TableCell>{strategyLabels[run.strategy_code]} · v{String(run.frozen_config.strategy_version ?? '-')}</TableCell><TableCell><RunBadge status={run.status} /></TableCell><TableCell>¥ {cnMoney(run.initial_capital)} / {(run.max_position_pct * 100).toFixed(0)}%</TableCell><TableCell>{formatDateTime(run.created_at)}</TableCell></TableRow>)}</TableBody></Table> : <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">暂无交易实例，请先创建一个草稿。</div>}
  </CardContent></Card>
}

function PlanTable({ plans }: { plans: TradeRunPlan[] }) {
  return <Card><CardHeader><SectionHeader title="手工执行计划" description="计划由受控策略服务生成；此处只读展示。行情非 fresh 或存在阻塞原因时，不能回填关联成交。" /></CardHeader><CardContent>
    {plans.length ? <Table><TableHeader><TableRow><TableHead>证券与方向</TableHead><TableHead>数量 / 参考价</TableHead><TableHead>价格区间</TableHead><TableHead>状态</TableHead><TableHead>数据状态</TableHead><TableHead>理由</TableHead></TableRow></TableHeader><TableBody>{plans.map((plan) => <TableRow key={plan.plan_id}><TableCell><div className="font-medium">{plan.ts_code}</div><div className="text-xs text-muted-foreground">{plan.asset_type === 'stock' ? '股票' : 'ETF'} · {plan.side === 'buy' ? '买入' : '卖出'} · #{plan.plan_id}</div></TableCell><TableCell>{plan.suggested_qty} 股<br /><span className="text-xs text-muted-foreground">¥ {fixed(plan.reference_price, 2)} · 已回填 {plan.filled_qty}</span></TableCell><TableCell>{priceRange(plan)}</TableCell><TableCell><PlanBadge status={plan.status} /></TableCell><TableCell><div><Badge variant={plan.data_status === 'fresh' ? 'default' : 'secondary'}>{plan.data_status}</Badge>{plan.blocked_reason && <p className="mt-1 text-xs text-destructive">{plan.blocked_reason}</p>}</div></TableCell><TableCell className="max-w-64"><p className="line-clamp-2 text-sm">{plan.reason}</p><p className="mt-1 text-xs text-muted-foreground">有效期至 {formatDateTime(plan.expires_at ?? '')}</p></TableCell></TableRow>)}</TableBody></Table> : <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">当前实例尚无执行计划。普通前端不会创建计划，请等待受控策略服务生成。</div>}
  </CardContent></Card>
}

function FillForm({ plans, run, onRecordFill }: { plans: TradeRunPlan[]; run: TradeRun; onRecordFill: (runId: number, params: RecordTradeRunFillParams) => Promise<void> }) {
  const executablePlans = plans.filter((plan) => plan.status === 'eligible' || plan.status === 'partially_filled').filter((plan) => plan.data_status === 'fresh' && !plan.blocked_reason)
  const [planId, setPlanId] = useState<number | ''>('')
  const [tsCode, setTsCode] = useState('')
  const [assetType, setAssetType] = useState<AssetType>('stock')
  const [side, setSide] = useState<'buy' | 'sell'>('buy')
  const [qty, setQty] = useState(100)
  const [price, setPrice] = useState(0)
  const [fee, setFee] = useState(5)
  const [executedAt, setExecutedAt] = useState(localDateTime())
  const [note, setNote] = useState('华泰成交回填')
  const [submitting, setSubmitting] = useState(false)
  const selectedPlan = executablePlans.find((plan) => plan.plan_id === planId)

  useEffect(() => {
    if (!selectedPlan) return
    setTsCode(selectedPlan.ts_code)
    setAssetType(selectedPlan.asset_type)
    setSide(selectedPlan.side)
    setQty(Math.max(100, selectedPlan.suggested_qty - selectedPlan.filled_qty))
    setPrice(selectedPlan.reference_price)
  }, [selectedPlan])

  async function submit() {
    if (submitting || !tsCode.trim() || qty <= 0 || qty % 100 !== 0 || price <= 0) return
    setSubmitting(true)
    try {
      const idempotencyKey = `manual-${run.run_id}-${Date.now()}-${tsCode.trim().toUpperCase()}-${side}`
      await onRecordFill(run.run_id, { idempotencyKey, planId: planId || undefined, tsCode: tsCode.trim().toUpperCase(), assetType, side, qty, price, fee, executedAt: new Date(executedAt).toISOString(), note, brokerQuoteConfirmed: true, quoteCheckedAt: new Date(executedAt).toISOString() })
      setPlanId('')
      setTsCode('')
      setPrice(0)
      setQty(100)
    } finally { setSubmitting(false) }
  }

  if (run.status !== 'running') return <Card><CardHeader><SectionHeader title="成交回填" description="仅运行中的实例允许回填成交。请先在总览中启动或恢复当前实例。" /></CardHeader></Card>
  return <Card><CardHeader><SectionHeader title="回填券商实际成交" description="这才会改变现金与持仓。每笔填写真实成交数据；同一请求重试会使用自动生成的幂等键避免重复记账。" /></CardHeader><CardContent className="grid gap-4">
    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">请先在券商端成交，再回填。计划关联可选；只有 fresh 且未阻塞的计划才可关联。</div>
    <label className="grid gap-2 text-sm"><span className="font-medium">关联可执行计划（可选）</span><select className="h-9 rounded-md border bg-background px-3 text-sm" value={planId} onChange={(event) => setPlanId(event.target.value ? Number(event.target.value) : '')}><option value="">不关联计划</option>{executablePlans.map((plan) => <option key={plan.plan_id} value={plan.plan_id}>#{plan.plan_id} · {plan.ts_code} · {plan.side === 'buy' ? '买入' : '卖出'} · 剩余 {plan.suggested_qty - plan.filled_qty}</option>)}</select></label>
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"><label className="grid gap-2 text-sm"><span className="font-medium">证券代码</span><Input placeholder="600000.SH" value={tsCode} onChange={(event) => setTsCode(event.target.value)} /></label><label className="grid gap-2 text-sm"><span className="font-medium">资产类型</span><select className="h-9 rounded-md border bg-background px-3 text-sm" value={assetType} onChange={(event) => setAssetType(event.target.value as AssetType)}><option value="stock">股票</option><option value="etf">ETF</option></select></label><label className="grid gap-2 text-sm"><span className="font-medium">方向</span><select className="h-9 rounded-md border bg-background px-3 text-sm" value={side} onChange={(event) => setSide(event.target.value as 'buy' | 'sell')}><option value="buy">买入</option><option value="sell">卖出</option></select></label><NumberInput label="数量（100 股倍数）" min={100} step={100} value={qty} onChange={setQty} /></div>
    <div className="grid gap-4 md:grid-cols-3"><NumberInput label="实际成交价" min={0.0001} step={0.01} value={price} onChange={setPrice} /><NumberInput label="费用" min={0} step={0.01} value={fee} onChange={setFee} /><label className="grid gap-2 text-sm"><span className="font-medium">实际成交时间</span><Input type="datetime-local" value={executedAt} onChange={(event) => setExecutedAt(event.target.value)} /></label></div>
    <label className="grid gap-2 text-sm"><span className="font-medium">备注</span><Input value={note} onChange={(event) => setNote(event.target.value)} /></label>
    <div className="flex flex-wrap items-center justify-between gap-3"><span className="text-sm text-muted-foreground">预计金额：¥ {cnMoney(qty * price + (side === 'buy' ? fee : -fee))}</span><Button disabled={submitting || !tsCode.trim() || qty <= 0 || qty % 100 !== 0 || price <= 0} onClick={submit}><FilePenLine />{submitting ? '提交中…' : '回填实际成交'}</Button></div>
  </CardContent></Card>
}

function PerformanceCard({ performance }: { performance: TradeRunPerformance | null }) {
  if (!performance) return null
  return <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="总权益" value={`¥ ${cnMoney(performance.total_equity)}`} /><MetricCard label="累计收益" value={signedPct(performance.return_pct * 100)} tone={toneFromNumber(performance.return_pct * 100)} /><MetricCard label="已实现收益" value={`¥ ${cnMoney(performance.realized_pnl)}`} tone={toneFromNumber(performance.realized_pnl)} /><MetricCard label="估值状态" value={performance.valuation_status} /></div>{performance.warning && <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">{performance.warning}</div>}</>
}

function PositionTable({ positions, loading }: { positions: TradeRunPosition[]; loading: boolean }) {
  return <Card><CardHeader><SectionHeader title="当前持仓" description="持仓仅由实际成交派生，不能直接编辑；成本价包含买入费用。" /></CardHeader><CardContent>{loading ? <TableSkeleton columns={6} /> : positions.length ? <Table><TableHeader><TableRow><TableHead>证券</TableHead><TableHead>数量</TableHead><TableHead>可卖数量</TableHead><TableHead>平均成本</TableHead><TableHead>开仓日</TableHead><TableHead>已实现收益</TableHead></TableRow></TableHeader><TableBody>{positions.map((position) => <TableRow key={position.ts_code}><TableCell><div className="font-medium">{position.ts_code}</div><div className="text-xs text-muted-foreground">{position.asset_type === 'stock' ? '股票' : 'ETF'}</div></TableCell><TableCell>{position.qty}</TableCell><TableCell>{position.sellable_qty}</TableCell><TableCell>¥ {fixed(position.avg_cost, 4)}</TableCell><TableCell>{position.open_date}</TableCell><TableCell className={toneClass(toneFromNumber(position.realized_pnl))}>¥ {cnMoney(position.realized_pnl)}</TableCell></TableRow>)}</TableBody></Table> : <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">暂无持仓。</div>}</CardContent></Card>
}

function EventTimeline({ events }: { events: TradeRunEvent[] }) {
  return <Card><CardHeader><SectionHeader title="审计时间线" description="交易实例生命周期、计划和成交回填均会保留审计事件。" /></CardHeader><CardContent>{events.length ? <div className="space-y-4">{events.map((event) => <div className="flex gap-3" key={event.event_id}><div className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" /><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{event.event_type}</Badge><span className="text-xs text-muted-foreground">{formatDateTime(event.created_at)}</span></div><p className="mt-1 text-sm">{event.message}</p>{Object.keys(event.payload).length > 0 && <pre className="mt-2 overflow-auto rounded bg-muted/50 p-2 text-xs text-muted-foreground">{JSON.stringify(event.payload, null, 2)}</pre>}</div></div>)}</div> : <div className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">暂无审计事件。</div>}</CardContent></Card>
}

function EmptyRunState() { return <div className="flex min-h-48 flex-col items-center justify-center rounded-lg border border-dashed bg-muted/20 p-8 text-center"><p className="font-medium">尚未选择交易实例</p><p className="mt-2 text-sm text-muted-foreground">创建草稿后，可通过右上角选择并管理该实例。</p></div> }
function RunBadge({ status }: { status: TradeRun['status'] }) { const map = { draft: ['草稿', 'secondary'], running: ['运行中', 'default'], paused: ['已暂停', 'secondary'], ended: ['已结束', 'outline'], deleted: ['已删除', 'destructive'] } as const; const [label, variant] = map[status]; return <Badge variant={variant}>{label}</Badge> }
function PlanBadge({ status }: { status: TradeRunPlan['status'] }) { const map = { generated: ['已生成', 'secondary'], eligible: ['可执行', 'default'], blocked: ['已阻塞', 'destructive'], partially_filled: ['部分成交', 'secondary'], triggered: ['已完成', 'outline'], expired: ['已过期', 'outline'], cancelled: ['已取消', 'outline'] } as const; const [label, variant] = map[status]; return <Badge variant={variant}>{label}</Badge> }
function NumberInput({ label, value, onChange, ...props }: { label: string; value: number; onChange: (value: number) => void } & Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'>) { return <label className="grid gap-2 text-sm"><span className="font-medium">{label}</span><Input {...props} type="number" value={Number.isFinite(value) ? value : ''} onChange={(event) => onChange(Number(event.target.value))} /></label> }
function CheckLabel({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) { return <label className="flex items-center gap-2"><Checkbox checked={checked} onCheckedChange={(value) => onChange(value === true)} />{label}</label> }
function priceRange(plan: TradeRunPlan) { if (plan.min_price == null && plan.max_price == null) return '-'; return `¥ ${plan.min_price == null ? '-' : fixed(plan.min_price, 2)} ~ ${plan.max_price == null ? '-' : fixed(plan.max_price, 2)}` }
function formatDateTime(value: string) { return value ? value.replace('T', ' ').slice(0, 16) : '-' }
function localDateTime() { const date = new Date(); date.setMinutes(date.getMinutes() - date.getTimezoneOffset()); return date.toISOString().slice(0, 16) }

type PaperPageProps = React.ComponentProps<typeof PaperPage>
const fallbackDefinitions: StrategyDefinition[] = [
  { code: 'short_term', name: '短线', description: '1-3 个交易日', version_id: 0, version_no: 1, algorithm_fingerprint: '' },
  { code: 'medium_term', name: '中线', description: '1-4 周', version_id: 0, version_no: 1, algorithm_fingerprint: '' },
  { code: 'long_term', name: '长线', description: '1-3 个月', version_id: 0, version_no: 1, algorithm_fingerprint: '' },
]
