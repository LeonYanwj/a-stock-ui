import { BarChart3, ChevronDown, Play } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, MetricCard, PhaseBadge, SectionHeader } from '@/components/dashboard/common'
import { strategyLabels } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { BacktestParams } from '@/lib/api'
import { fixed, signedPct, toneFromNumber } from '@/lib/format'
import type { BacktestApiRun, Strategy, TaskStatus } from '@/types'

export function BacktestPage({
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
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="最近回测数" value={String(runs.length)} />
        <MetricCard label="最佳年化" tone={toneFromNumber(bestMetric(runs, 'ann_return') * 100)} value={signedPct(bestMetric(runs, 'ann_return') * 100)} />
        <MetricCard label="最小回撤" value={signedPct(bestDrawdown(runs) * 100)} />
        <MetricCard label="平均 Sharpe" value={fixed(avgMetric(runs, 'sharpe'))} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.9fr)]">
        <Card>
          <CardHeader>
            <SectionHeader action={<BarChart3 className="size-5 text-muted-foreground" />} description="按最近回测聚合展示各策略平均表现" title="策略对比" />
          </CardHeader>
          <CardContent>
            <BacktestChart data={comparison} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <SectionHeader title="异步回测" description="发起新回测作为次要操作" />
          </CardHeader>
          <CardContent className="space-y-4">
            <TaskSummary task={latestBacktest} />
            <button className="flex w-full items-center gap-2 rounded-md border bg-muted/20 p-3 text-left" onClick={() => setFormOpen((value) => !value)} type="button">
              <Play className="size-4 text-primary" />
              <span className="flex-1 text-sm font-medium">发起新回测</span>
              <ChevronDown className={`size-4 transition-transform ${formOpen ? 'rotate-180' : ''}`} />
            </button>
            {formOpen && (
              <div className="space-y-3 rounded-md border p-3">
                <Tabs onValueChange={(value) => onStrategyChange(value as Strategy)} value={strategy}>
                  <TabsList className="w-full justify-start overflow-x-auto">
                    {strategies.map((key) => (
                      <TabsTrigger key={key} value={key}>{strategyLabels[key]}</TabsTrigger>
                    ))}
                  </TabsList>
                </Tabs>
                <div className="grid gap-3 sm:grid-cols-2">
                  <NumberField label="回测月数" onChange={setMonths} value={months} />
                  <NumberField label="股票池规模" onChange={setLimit} value={limit} />
                  <NumberField hint="0=按资金自动" label="Top 数" onChange={setTop} value={top} />
                  <NumberField label="资金量" onChange={setCapital} value={capital} />
                  <NumberField label="调仓周数" onChange={setRebalWeeks} value={rebalWeeks} />
                </div>
                <Button className="w-full" onClick={() => onRun({ strategy, months, limit, top, capital, rebalWeeks })}>
                  <Play />跑回测
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <BacktestTable runs={runs} />
    </div>
  )
}

function BacktestChart({ data }: { data: Array<{ strategy: string; ann_return: number; max_drawdown: number }> }) {
  if (!data.length) return <EmptyState title="暂无回测记录" />
  return (
    <div className="h-[286px]">
      <ResponsiveContainer height="100%" width="100%">
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="strategy" />
          <YAxis tickFormatter={(value) => signedPct(Number(value) * 100)} />
          <Tooltip formatter={(value) => signedPct(Number(value) * 100)} />
          <Bar dataKey="ann_return" fill="var(--chart-1)" name="年化收益" radius={[4, 4, 0, 0]} />
          <Bar dataKey="max_drawdown" fill="var(--chart-3)" name="最大回撤" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function BacktestTable({ runs }: { runs: BacktestApiRun[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">最近回测结果</CardTitle>
      </CardHeader>
      <CardContent>
        {runs.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Run</TableHead>
                <TableHead>策略</TableHead>
                <TableHead className="min-w-48">区间</TableHead>
                <TableHead>年化</TableHead>
                <TableHead>回撤</TableHead>
                <TableHead>Sharpe</TableHead>
                <TableHead>胜率</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {runs.map((run) => (
                <TableRow key={run.run_id}>
                  <TableCell>#{run.run_id}</TableCell>
                  <TableCell>{strategyLabels[run.strategy_name]}</TableCell>
                  <TableCell>{run.start_date} ~ {run.end_date}</TableCell>
                  <TableCell>{signedPct((run.ann_return ?? 0) * 100)}</TableCell>
                  <TableCell>{signedPct((run.max_drawdown ?? 0) * 100)}</TableCell>
                  <TableCell>{fixed(run.sharpe ?? 0)}</TableCell>
                  <TableCell>{signedPct((run.win_rate ?? 0) * 100)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="暂无回测记录" />
        )}
      </CardContent>
    </Card>
  )
}

function TaskSummary({ task }: { task?: TaskStatus }) {
  if (!task) return <div className="rounded-md border bg-muted/20 p-3 text-sm text-muted-foreground">没有最近回测任务。</div>
  return (
    <div className="rounded-md border p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">回测任务</p>
        <PhaseBadge status={task.status} />
      </div>
      <Progress className="mt-3" value={task.progress ?? 0} />
      <p className="mt-2 text-xs leading-5 text-muted-foreground">{task.progress_msg || task.error || task.task_id}</p>
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
    <label className="grid gap-2 text-sm">
      <span className="font-medium text-muted-foreground">{label}</span>
      <Input min={0} onChange={(event) => onChange(Number(event.target.value))} type="number" value={value} />
      {hint && <em className="text-xs not-italic text-muted-foreground">{hint}</em>}
    </label>
  )
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
