import { Activity, Play, RefreshCw, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { LoadingProgressCard, MetricCard, PhaseBadge, SectionHeader, TableSkeleton, toneClass } from '@/components/dashboard/common'
import type { StreamState } from '@/components/dashboard/common'
import { strategyLabels } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import type { DailyRunParams } from '@/lib/api'
import { cnMoney, fixed, signedPct, toneFromNumber } from '@/lib/format'
import type { AccountApiRow, EquityApiPoint, PositionApiRow, TaskStatus, TradeApiRow } from '@/types'

interface AutoRebalanceResult {
  sold?: { n?: number; revenue?: number }
  bought?: { n?: number; spent?: number }
  total_equity?: number
}

interface DailyRunResult {
  log?: string
}

export function PaperPage({
  accounts,
  selectedAccount,
  positions,
  trades,
  equityCurve,
  dailyReport,
  tasks,
  accountLoading,
  positionStream,
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
  accountLoading: boolean
  positionStream: StreamState
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
  const latestRebalance = tasks.find((task) => task.name === 'auto_rebalance')
  const latestDailyRun = tasks.find((task) => task.name === 'daily_run')

  return (
    <Tabs className="space-y-5" defaultValue="overview">
      <div className="w-full overflow-x-auto pb-1">
        <TabsList>
          <TabsTrigger value="overview">总览</TabsTrigger>
          <TabsTrigger value="positions">持仓同步</TabsTrigger>
          <TabsTrigger value="activity">流水任务</TabsTrigger>
          <TabsTrigger value="actions">调仓操作</TabsTrigger>
        </TabsList>
      </div>

      <TabsContent className="space-y-5" value="overview">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {accounts.map((account) => (
            <button
              className={`rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-primary ${
                selectedAccount.account_id === account.account_id ? 'border-primary ring-2 ring-primary/15' : ''
              }`}
              key={account.account_id}
              onClick={() => onSelectAccount(account.account_id)}
              type="button"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{account.account_name}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{strategyLabels[account.strategy_name]}</p>
                </div>
                <Badge variant={account.is_active ? 'default' : 'secondary'}>{account.is_active ? 'active' : 'paused'}</Badge>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <strong className="text-xl">{cnMoney(account.current_equity)}</strong>
                <span className={`text-sm font-medium ${toneClass(toneFromNumber(account.return_pct))}`}>
                  {signedPct(account.return_pct)}
                </span>
              </div>
            </button>
          ))}
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="当前权益" value={cnMoney(selectedAccount.current_equity)} helper={`现金 ${cnMoney(selectedAccount.current_cash)}`} />
          <MetricCard label="日权益变化" value={equityDelta(latestEquity, previousEquity)} tone={toneFromNumber((latestEquity?.daily_return ?? 0) * 100)} />
          <MetricCard label="持仓市值" value={cnMoney(positionValue)} helper={`${positions.length} 只持仓`} />
          <MetricCard label="平均浮盈亏" value={signedPct(unrealizedPct * 100)} tone={toneFromNumber(unrealizedPct * 100)} />
        </div>

        <Card>
          <CardHeader>
            <SectionHeader title="账户权益" description="现金、持仓市值和总权益随时间变化" />
          </CardHeader>
          <CardContent>
            <EquityChart data={equityCurve} loading={accountLoading} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent className="space-y-5" value="positions">
        <PositionsTable positions={positions} loading={accountLoading} stream={positionStream} onRatePosition={onRatePosition} />
      </TabsContent>

      <TabsContent className="space-y-5" value="activity">
        <div className="grid gap-5 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <Card>
            <CardHeader>
              <SectionHeader title="任务摘要" description="自动调仓、每日流程和报告回看" />
            </CardHeader>
            <CardContent className="space-y-4">
              <TaskSummary task={latestRebalance} title="最近自动调仓" />
              <TaskSummary task={latestDailyRun} title="最近每日流程" />
              {dailyReport && (
                <details className="rounded-md border bg-muted/30 p-3">
                  <summary className="cursor-pointer text-sm font-medium">单日复盘报告</summary>
                  <pre className="mt-3 max-h-52 overflow-auto whitespace-pre-wrap text-xs leading-6 text-muted-foreground">
                    {dailyReport}
                  </pre>
                </details>
              )}
            </CardContent>
          </Card>
          <TradesTable trades={trades} />
        </div>
      </TabsContent>

      <TabsContent className="space-y-5" value="actions">
        <div className="max-w-xl">
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
        </div>
      </TabsContent>
    </Tabs>
  )
}

function EquityChart({ data, loading }: { data: EquityApiPoint[]; loading: boolean }) {
  if (loading || !data.length) return <TableSkeleton rows={5} columns={4} />
  return (
    <div className="h-[286px]">
      <ResponsiveContainer height="100%" width="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="equity" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.24} />
              <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="market" x1="0" x2="0" y1="0" y2="1">
              <stop offset="5%" stopColor="var(--chart-2)" stopOpacity={0.18} />
              <stop offset="95%" stopColor="var(--chart-2)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="trade_date" />
          <YAxis tickFormatter={(value) => `${Math.round(Number(value) / 1000)}k`} />
          <Tooltip formatter={(value) => cnMoney(Number(value))} />
          <Area dataKey="total_equity" fill="url(#equity)" name="总权益" stroke="var(--chart-1)" strokeWidth={2.4} type="monotone" />
          <Area dataKey="market_value" fill="url(#market)" name="持仓市值" stroke="var(--chart-2)" strokeWidth={2} type="monotone" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function PositionsTable({
  positions,
  loading,
  stream,
  onRatePosition,
}: {
  positions: PositionApiRow[]
  loading: boolean
  stream: StreamState
  onRatePosition: (code: string) => void
}) {
  const showRealtimeLoading = loading || stream.active
  return (
    <Card>
      <CardHeader>
        <SectionHeader title="当前持仓与浮盈亏" description="实时价格会通过 SSE 分阶段加载" />
      </CardHeader>
      <CardContent>
        {showRealtimeLoading ? (
          <LoadingProgressCard stream={stream} title="持仓实时同步" />
        ) : positions.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="min-w-40">股票</TableHead>
                <TableHead>数量</TableHead>
                <TableHead>成本</TableHead>
                <TableHead>现价</TableHead>
                <TableHead>浮盈亏</TableHead>
                <TableHead>市值</TableHead>
                <TableHead>价格源</TableHead>
                <TableHead>研究</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {positions.map((position) => (
                <TableRow key={position.ts_code}>
                  <TableCell>
                    <div className="font-medium">{position.name || position.ts_code}</div>
                    <div className="text-xs text-muted-foreground">{position.ts_code} · 开仓 {formatDate(position.open_date)}</div>
                  </TableCell>
                  <TableCell>{position.qty}</TableCell>
                  <TableCell>{fixed(position.avg_cost)}</TableCell>
                  <TableCell>{fixed(position.current_price ?? 0)}</TableCell>
                  <TableCell className={toneClass(toneFromNumber((position.return_pct ?? 0) * 100))}>
                    {signedPct((position.return_pct ?? 0) * 100)}
                  </TableCell>
                  <TableCell>{cnMoney(position.market_value ?? 0)}</TableCell>
                  <TableCell>{priceSourceLabel(position.price_source)}</TableCell>
                  <TableCell>
                    <Button onClick={() => onRatePosition(position.ts_code)} size="sm" variant="outline">评级</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">当前账户没有持仓记录。</div>
        )}
      </CardContent>
    </Card>
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
    <Card>
      <CardHeader>
        <SectionHeader title="调仓与复盘动作" description="保留自动调仓、止损、快照和每日流程" />
      </CardHeader>
      <CardContent className="space-y-4">
        <label className="grid gap-2 text-sm">
          <span className="font-medium text-muted-foreground">选股股票池</span>
          <Input min={0} onChange={(event) => onLimitChange(Number(event.target.value))} type="number" value={limit} />
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={enableNews} onCheckedChange={(checked) => onEnableNewsChange(Boolean(checked))} />
          调仓启用消息面
        </label>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={dryRun} onCheckedChange={(checked) => onDryRunChange(Boolean(checked))} />
          每日流程 dry-run
        </label>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={onRefresh} variant="outline"><RefreshCw />刷新</Button>
          <Button onClick={onStoploss} variant="outline"><ShieldCheck />止损</Button>
          <Button onClick={onSnapshot} variant="outline"><Activity />快照</Button>
          <Button onClick={onAutoRebalance}><Play />调仓</Button>
          <Button className="col-span-2" onClick={onDailyRun} variant="secondary"><Play />每日流程</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function TradesTable({ trades }: { trades: TradeApiRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">最近成交</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {trades.length ? trades.map((trade) => (
          <div className="flex items-center gap-3 border-b py-3 last:border-0" key={trade.trade_id}>
            <Badge className={trade.side === 'BUY' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}>{trade.side}</Badge>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{trade.name || trade.ts_code}</div>
              <div className="truncate text-xs text-muted-foreground">
                {trade.ts_code} · {formatDate(trade.trade_time ?? trade.trade_date)} · {trade.reason ?? 'MANUAL'}
              </div>
            </div>
            <div className="text-right text-sm font-medium">{trade.qty} @ {fixed(trade.price)}</div>
          </div>
        )) : <p className="text-sm text-muted-foreground">暂无成交记录。</p>}
      </CardContent>
    </Card>
  )
}

function TaskSummary({ task, title }: { task?: TaskStatus; title: string }) {
  if (!task) {
    return (
      <div className="rounded-md border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium">{title}</p>
          <PhaseBadge />
        </div>
      </div>
    )
  }
  const rebalance = task.result as AutoRebalanceResult | undefined
  const daily = task.result as DailyRunResult | undefined
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">{title}</p>
        <PhaseBadge status={task.status} />
      </div>
      <Progress className="mt-3" value={task.progress ?? 0} />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{task.progress_msg || task.error || task.task_id}</p>
      {rebalance?.sold && (
        <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
          <div><span className="text-muted-foreground">卖出</span><b className="block">{rebalance.sold.n ?? 0} 笔</b></div>
          <div><span className="text-muted-foreground">买入</span><b className="block">{rebalance.bought?.n ?? 0} 笔</b></div>
          <div><span className="text-muted-foreground">权益</span><b className="block">{cnMoney(rebalance.total_equity ?? 0)}</b></div>
        </div>
      )}
      {daily?.log && <pre className="mt-3 max-h-40 overflow-auto whitespace-pre-wrap text-xs text-muted-foreground">{daily.log.slice(0, 420)}</pre>}
    </div>
  )
}

function equityDelta(latest?: EquityApiPoint, previous?: EquityApiPoint) {
  if (latest?.daily_return !== undefined && latest.daily_return !== null) return signedPct(latest.daily_return * 100)
  if (!latest || !previous || !previous.total_equity) return '-'
  return signedPct((latest.total_equity / previous.total_equity - 1) * 100)
}

function priceSourceLabel(source?: string | null) {
  return ({ realtime: '实时', close: '收盘', cost: '成本' } as Record<string, string>)[source ?? ''] ?? source ?? '-'
}

function formatDate(value: string) {
  return value ? value.slice(0, 10) : '-'
}
