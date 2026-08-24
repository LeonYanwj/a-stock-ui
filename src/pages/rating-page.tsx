import { ChevronDown, Loader2, Play, Search, Sparkles } from 'lucide-react'
import { useEffect, useState } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { EmptyState, LoadingProgressCard, SectionHeader, toneClass } from '@/components/dashboard/common'
import type { StreamState } from '@/components/dashboard/common'
import { strategyDescriptions, strategyLabels } from '@/components/layout/app-shell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import type { ScreenParams } from '@/lib/api'
import { cnMoney, fixed, signedPct, toneFromNumber } from '@/lib/format'
import type {
  AccountApiRow,
  DailyBar,
  PositionApiRow,
  RatingApiResponse,
  ScreenApiPick,
  ScreenApiResult,
  Strategy,
  TaskStatus,
} from '@/types'

export function RatingPage({
  positions,
  selectedAccount,
  strategies,
  strategy,
  rating,
  dailyBars,
  selectedCode,
  screenResult,
  screenTask,
  ratingStream,
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
  screenTask?: TaskStatus
  ratingStream: StreamState
  onStrategyChange: (value: Strategy) => void
  onRun: (code: string, strategy: Strategy, noFlow?: boolean, noNews?: boolean) => void
  onRunScreen: (params: ScreenParams) => void
}) {
  const [code, setCode] = useState(selectedCode || positions[0]?.ts_code || '')
  const [noFlow, setNoFlow] = useState(false)
  const [noNews, setNoNews] = useState(false)
  const [screenOpen, setScreenOpen] = useState(false)
  const ratingBusy = ratingStream.active

  useEffect(() => {
    if (selectedCode) setCode(selectedCode)
  }, [selectedCode])

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader>
          <SectionHeader
            title="从持仓进入评级解释"
            description={selectedAccount ? `${selectedAccount.account_name} 的当前持仓会作为研究入口` : '也可以手动输入股票代码补充研究'}
          />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <Tabs onValueChange={(value) => onStrategyChange(value as Strategy)} value={strategy}>
              <TabsList className="w-full justify-start overflow-x-auto xl:w-auto">
                {strategies.map((key) => (
                  <TabsTrigger key={key} title={strategyDescriptions[key]} value={key}>{strategyLabels[key]}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 sm:w-[320px]">
                <Search className="pointer-events-none absolute left-3 top-2.5 size-4 text-muted-foreground" />
                <Input className="pl-9" onChange={(event) => setCode(event.target.value)} placeholder="002028 或 600487.SH" value={code} />
              </div>
              <Button disabled={ratingBusy || !code.trim()} onClick={() => onRun(code, strategy, noFlow, noNews)}>
                {ratingBusy && <Loader2 className="animate-spin" />}
                {ratingBusy ? '评级中' : '评级'}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={noFlow} onCheckedChange={(checked) => setNoFlow(Boolean(checked))} />
              跳过资金面
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={noNews} onCheckedChange={(checked) => setNoNews(Boolean(checked))} />
              跳过消息面
            </label>
          </div>
          {ratingStream.active && <LoadingProgressCard stream={ratingStream} title="评级流式计算" />}
        </CardContent>
      </Card>

      <div className="grid gap-5 xl:grid-cols-[360px_minmax(0,1fr)]">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">持仓入口</CardTitle>
          </CardHeader>
          <CardContent>
            <HoldingRatingList
              disabled={ratingBusy}
              positions={positions}
              onSelect={(item) => onRun(item.ts_code, strategy, noFlow, noNews)}
            />
          </CardContent>
        </Card>
        {rating ? (
          <RatingDetail dailyBars={dailyBars} loading={ratingStream.active} rating={rating} />
        ) : (
          <EmptyState description="点击左侧持仓，或输入代码后发起评级。" title="等待评级结果" />
        )}
      </div>

      <Card>
        <CardHeader>
          <button className="flex w-full items-center gap-2 text-left" onClick={() => setScreenOpen((value) => !value)} type="button">
            <Sparkles className="size-4 text-primary" />
            <span className="flex-1 font-semibold">候选补充</span>
            <ChevronDown className={`size-4 transition-transform ${screenOpen ? 'rotate-180' : ''}`} />
          </button>
        </CardHeader>
        {screenOpen && (
          <CardContent>
            <AuxiliaryScreening result={screenResult} strategy={strategy} task={screenTask} onRun={onRunScreen} />
          </CardContent>
        )}
      </Card>
    </div>
  )
}

function HoldingRatingList({
  positions,
  disabled,
  onSelect,
}: {
  positions: PositionApiRow[]
  disabled: boolean
  onSelect: (position: PositionApiRow) => void
}) {
  if (!positions.length) return <p className="text-sm leading-6 text-muted-foreground">当前账户暂无持仓，可使用上方输入框手动评级。</p>
  return (
    <div className="space-y-2">
      {positions.map((position) => (
        <button
          className="flex w-full items-center justify-between gap-3 rounded-md border bg-muted/20 p-3 text-left transition hover:border-primary hover:bg-muted/40 disabled:pointer-events-none disabled:opacity-55"
          disabled={disabled}
          key={position.ts_code}
          onClick={() => onSelect(position)}
          type="button"
        >
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{position.name || position.ts_code}</span>
            <span className="mt-1 block truncate text-xs text-muted-foreground">{position.ts_code} · 市值 {cnMoney(position.market_value ?? 0)}</span>
          </span>
          <b className={`text-sm ${toneClass(toneFromNumber((position.return_pct ?? 0) * 100))}`}>
            {signedPct((position.return_pct ?? 0) * 100)}
          </b>
        </button>
      ))}
    </div>
  )
}

function RatingDetail({
  rating,
  dailyBars,
  loading,
}: {
  rating: RatingApiResponse
  dailyBars: DailyBar[]
  loading: boolean
}) {
  return (
    <div className="grid gap-5 xl:grid-cols-[300px_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-muted-foreground">{rating.ts_code} · {rating.asof}</p>
              <CardTitle className="mt-1 text-xl">{rating.name || '未命名股票'}</CardTitle>
            </div>
            <Badge>{strategyLabels[rating.strategy]}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div
            className="mx-auto grid size-40 place-items-center rounded-full"
            style={{
              background: `radial-gradient(circle at center, var(--card) 57%, transparent 58%), conic-gradient(var(--primary) 0 ${((rating.overall_stars ?? 0) / 5) * 100}%, var(--muted) 0 100%)`,
            }}
          >
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{rating.grade}</div>
              <div className="mt-2 text-sm font-medium">{fixed(rating.overall_stars ?? 0, 2)} 星</div>
            </div>
          </div>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">评级用于解释当前持仓质量，不构成交易建议。</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <SectionHeader title="近期走势" description="90 日收盘价" />
        </CardHeader>
        <CardContent>{loading ? <LoadingProgressCard stream={{ active: true, progress: 95, message: '等待评级完成' }} title="日线加载" /> : <DailyChart data={dailyBars} />}</CardContent>
      </Card>

      <Card className="xl:col-span-2">
        <CardHeader>
          <SectionHeader title="评分与因子说明" description="五维评分、权重和因子解释" />
        </CardHeader>
        <CardContent className="space-y-3">
          {rating.dimensions.map((dimension) => (
            <div className="rounded-md border bg-muted/20 p-4" key={dimension.key}>
              <div className="grid gap-3 md:grid-cols-[180px_minmax(0,1fr)_52px] md:items-center">
                <div>
                  <div className="font-medium">{dimension.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground">权重 {dimension.weight}</div>
                </div>
                <Progress value={((dimension.stars ?? 0) / 5) * 100} />
                <b>{fixed(dimension.stars ?? 0, 1)}</b>
              </div>
              <div className="mt-3 grid gap-2">
                {dimension.factors.map((factor) => (
                  <div className="grid gap-2 text-sm md:grid-cols-[140px_minmax(0,1fr)]" key={factor.key}>
                    <span className="text-muted-foreground">{factor.key}</span>
                    <span className="leading-6">{factor.desc}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}

function AuxiliaryScreening({
  strategy,
  result,
  task,
  onRun,
}: {
  strategy: Strategy
  result: ScreenApiResult | null
  task?: TaskStatus
  onRun: (params: ScreenParams) => void
}) {
  const [capital, setCapital] = useState(100000)
  const [top, setTop] = useState(0)
  const [limit, setLimit] = useState(300)
  const [lookback, setLookback] = useState(60)
  const [enableNews, setEnableNews] = useState(false)
  const taskActive = task?.status === 'pending' || task?.status === 'running'
  const taskDone = task?.status === 'done'
  const taskFailed = task?.status === 'failed'
  const progress = Math.round(task?.progress ?? 0)

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
        <NumberField label="资金量" onChange={setCapital} value={capital} />
        <NumberField hint="0=自动" label="指定 Top" onChange={setTop} value={top} />
        <NumberField label="股票池" onChange={setLimit} value={limit} />
        <NumberField label="回看天数" onChange={setLookback} value={lookback} />
        <label className="flex items-end gap-2 pb-2 text-sm">
          <Checkbox checked={enableNews} onCheckedChange={(checked) => setEnableNews(Boolean(checked))} />
          启用消息面
        </label>
        <Button
          disabled={taskActive}
          onClick={() => onRun({ strategy, capital, top, limit, lookback, enableNews })}
        >
          {taskActive ? <Loader2 className="animate-spin" /> : <Play />}
          {taskActive ? '选股中' : '跑候选'}
        </Button>
      </div>

      {task && (
        <div className="rounded-md border bg-muted/20 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium">
                {taskActive && '候选选股正在执行'}
                {taskDone && '候选选股已完成'}
                {taskFailed && '候选选股失败'}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {task.progress_msg || task.error || `任务 ID：${task.task_id}`}
              </div>
            </div>
            <Badge variant={taskFailed ? 'destructive' : taskDone ? 'default' : 'secondary'}>
              {taskFailed ? 'failed' : taskDone ? 'done' : `${progress}%`}
            </Badge>
          </div>
          <Progress className="mt-3" value={taskDone ? 100 : progress} />
        </div>
      )}

      <PickTable picks={result?.picks ?? []} />
    </div>
  )
}

function PickTable({ picks }: { picks: ScreenApiPick[] }) {
  if (!picks.length) return <p className="text-sm text-muted-foreground">候选结果会在异步选股完成后显示。</p>
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>排名</TableHead>
          <TableHead>股票</TableHead>
          <TableHead>得分</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {picks.map((pick) => (
          <TableRow key={pick.ts_code}>
            <TableCell>#{pick.rank_num}</TableCell>
            <TableCell>
              <div className="font-medium">{pick.name ?? '未知'}</div>
              <div className="text-xs text-muted-foreground">{pick.ts_code}</div>
            </TableCell>
            <TableCell>{fixed(pick.score)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function DailyChart({ data }: { data: DailyBar[] }) {
  if (!data.length) return <EmptyState title="日线数据未返回" />
  return (
    <div className="h-[250px]">
      <ResponsiveContainer height="100%" width="100%">
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="trade_date" />
          <YAxis domain={['dataMin', 'dataMax']} />
          <Tooltip formatter={(value) => fixed(Number(value))} />
          <Line dataKey="close" dot={false} name="收盘价" stroke="var(--chart-1)" strokeWidth={2.4} type="monotone" />
        </LineChart>
      </ResponsiveContainer>
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
