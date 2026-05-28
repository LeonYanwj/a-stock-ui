import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { TaskPhase } from '@/types'

export interface StreamState {
  active: boolean
  progress: number
  message: string
  error?: string
}

export function SectionHeader({
  title,
  description,
  action,
}: {
  title: string
  description?: string
  action?: ReactNode
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-normal text-foreground">{title}</h2>
        {description && <p className="mt-1 text-sm leading-6 text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function MetricCard({
  label,
  value,
  helper,
  tone = 'neutral',
}: {
  label: string
  value: string
  helper?: string
  tone?: 'positive' | 'negative' | 'neutral'
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={cn('text-2xl font-semibold', toneClass(tone))}>{value}</div>
        {helper && <p className="mt-2 text-xs text-muted-foreground">{helper}</p>}
      </CardContent>
    </Card>
  )
}

export function LoadingProgressCard({
  title,
  stream,
  fallback = '正在加载实时数据',
}: {
  title: string
  stream: StreamState
  fallback?: string
}) {
  return (
    <div className="rounded-md border bg-muted/30 p-4">
      <div className="flex items-center gap-3">
        <Loader2 className="size-4 animate-spin text-primary" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-3">
            <p className="truncate text-sm font-medium">{title}</p>
            <span className="text-xs text-muted-foreground">{Math.round(stream.progress || 0)}%</span>
          </div>
          <p className="mt-1 truncate text-xs text-muted-foreground">{stream.message || fallback}</p>
        </div>
      </div>
      <Progress className="mt-3" value={stream.progress || 8} />
    </div>
  )
}

export function EmptyState({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex min-h-[220px] flex-col items-center justify-center rounded-md border border-dashed bg-muted/20 p-8 text-center">
      <p className="text-sm font-medium text-foreground">{title}</p>
      {description && <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
    </div>
  )
}

export function TableSkeleton({ rows = 4, columns = 5 }: { rows?: number; columns?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, row) => (
        <div className="grid gap-3" key={row} style={{ gridTemplateColumns: `repeat(${columns}, minmax(84px, 1fr))` }}>
          {Array.from({ length: columns }).map((__, column) => (
            <Skeleton className="h-8" key={column} />
          ))}
        </div>
      ))}
    </div>
  )
}

export function PhaseBadge({ status }: { status?: TaskPhase | string }) {
  if (status === 'done') return <Badge className="bg-emerald-600 text-white">done</Badge>
  if (status === 'failed') return <Badge variant="destructive">failed</Badge>
  if (status === 'running') return <Badge className="bg-blue-600 text-white">running</Badge>
  return <Badge variant="secondary">{status ?? 'idle'}</Badge>
}

export function toneClass(tone: 'positive' | 'negative' | 'neutral') {
  if (tone === 'positive') return 'text-emerald-600'
  if (tone === 'negative') return 'text-red-600'
  return 'text-foreground'
}
