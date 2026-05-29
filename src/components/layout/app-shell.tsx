import {
  BarChart3,
  BriefcaseBusiness,
  LineChart,
  PanelLeft,
  RefreshCw,
  Search,
  WalletCards,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { AccountApiRow, Strategy } from '@/types'

export type View = 'paper' | 'rating' | 'backtest'

const navItems: Array<{ key: View; label: string; icon: typeof WalletCards }> = [
  { key: 'paper', label: '模拟盘', icon: WalletCards },
  { key: 'rating', label: '持仓评级', icon: Search },
  { key: 'backtest', label: '回测表现', icon: LineChart },
]

export const strategyLabels: Record<Strategy, string> = {
  short_term: '短线',
  swing: '波段',
  trend: '趋势',
  ic_optimized: 'IC 优化',
}

export const strategyDescriptions: Record<Strategy, string> = {
  short_term: '1-3 天，重资金流、量价齐升、MACD 与短期反转。',
  swing: '1-4 周，综合价值、质量、资金、技术和消息面。',
  trend: '1-3 月，偏长动量和资金持续流入。',
  ic_optimized: '基于多窗口 IC 调权重，偏稳健验证。',
}

export function AppShell({
  view,
  onViewChange,
  title,
  subtitle,
  apiBaseUrl,
  health,
  selectedAccount,
  strategy,
  onRefresh,
  children,
}: {
  view: View
  onViewChange: (view: View) => void
  title: string
  subtitle: string
  apiBaseUrl: string
  health: { status: string; db: string } | null
  selectedAccount?: AccountApiRow
  strategy: Strategy
  onRefresh: () => void
  children: ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)
  const handleViewChange = (nextView: View) => {
    onViewChange(nextView)
    setMobileSidebarOpen(false)
  }

  return (
    <TooltipProvider>
      <div className="min-h-svh bg-background text-foreground">
        <aside
          className={cn(
            'fixed inset-y-0 left-0 z-30 hidden w-64 border-r bg-sidebar text-sidebar-foreground transition-transform duration-200 md:block',
            !sidebarOpen && '-translate-x-full',
          )}
        >
          <SidebarContents apiBaseUrl={apiBaseUrl} health={health} onViewChange={handleViewChange} view={view} />
        </aside>

        {mobileSidebarOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <button
              aria-label="关闭侧栏"
              className="absolute inset-0 bg-foreground/25"
              onClick={() => setMobileSidebarOpen(false)}
              type="button"
            />
            <aside className="absolute inset-y-0 left-0 w-72 border-r bg-sidebar text-sidebar-foreground shadow-xl">
              <div className="absolute right-3 top-3 z-10">
                <Button aria-label="关闭侧栏" onClick={() => setMobileSidebarOpen(false)} size="icon" variant="ghost">
                  <X className="size-4" />
                </Button>
              </div>
              <SidebarContents apiBaseUrl={apiBaseUrl} health={health} onViewChange={handleViewChange} view={view} />
            </aside>
          </div>
        )}

        <div className={cn('transition-[padding] duration-200', sidebarOpen && 'md:pl-64')}>
          <header className="sticky top-0 z-20 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
            <div className="flex h-full items-center gap-3 px-4 sm:gap-4 lg:px-6">
              <Button
                aria-label={sidebarOpen ? '收起侧栏' : '展开侧栏'}
                onClick={() => {
                  if (window.matchMedia('(min-width: 768px)').matches) {
                    setSidebarOpen((value) => !value)
                  } else {
                    setMobileSidebarOpen(true)
                  }
                }}
                size="icon"
                variant="outline"
              >
                <PanelLeft className="size-4" />
              </Button>
              <Separator className="h-6" orientation="vertical" />
              <div className="hidden min-w-0 items-center gap-1 md:flex">
                {navItems.map((item) => (
                  <Button
                    className="h-8"
                    key={item.key}
                    onClick={() => handleViewChange(item.key)}
                    size="sm"
                    variant={view === item.key ? 'secondary' : 'ghost'}
                  >
                    {item.label}
                  </Button>
                ))}
              </div>
              <div className="ms-auto flex min-w-0 items-center gap-2">
                <div className="inline-flex h-9 items-center gap-2 rounded-md border bg-card px-3 text-sm">
                  <BriefcaseBusiness className="size-4 text-muted-foreground" />
                  <span className="max-w-36 truncate">
                    {view === 'paper' ? selectedAccount?.account_name ?? '未选择账户' : `${strategyLabels[strategy]}策略`}
                  </span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button aria-label="刷新数据" onClick={onRefresh} size="icon" variant="outline">
                      <RefreshCw className="size-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>刷新基础数据</TooltipContent>
                </Tooltip>
              </div>
            </div>
            <div className="flex gap-1 overflow-x-auto border-t px-3 py-2 md:hidden">
              {navItems.map((item) => {
                const Icon = item.icon
                return (
                  <Button
                    key={item.key}
                    onClick={() => handleViewChange(item.key)}
                    size="sm"
                    variant={view === item.key ? 'default' : 'ghost'}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Button>
                )
              })}
            </div>
          </header>
          <main className="px-4 py-6 lg:px-6">
            <div className="mx-auto w-full max-w-7xl space-y-5">
              <div className="mb-2 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase text-muted-foreground">holdings research</p>
                  <h1 className="truncate text-2xl font-bold tracking-tight">{title}</h1>
                  <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
                </div>
              </div>
              {children}
            </div>
          </main>
        </div>
      </div>
    </TooltipProvider>
  )
}

function SidebarContents({
  view,
  onViewChange,
  apiBaseUrl,
  health,
}: {
  view: View
  onViewChange: (view: View) => void
  apiBaseUrl: string
  health: { status: string; db: string } | null
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center gap-3 px-4">
        <div className="flex size-9 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
          <BarChart3 className="size-5" />
        </div>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">持仓研究台</div>
          <div className="truncate text-xs text-muted-foreground">A 股量化复盘</div>
        </div>
      </div>
      <Separator className="bg-sidebar-border" />
      <nav className="grid gap-1 p-2">
        <div className="px-2 pb-1 pt-2 text-xs font-medium text-muted-foreground">Workspace</div>
        {navItems.map((item) => {
          const Icon = item.icon
          return (
            <button
              className={cn(
                'flex h-8 items-center gap-2 rounded-md px-2 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                view === item.key && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground',
              )}
              key={item.key}
              onClick={() => onViewChange(item.key)}
              type="button"
            >
              <Icon className="size-4" />
              {item.label}
            </button>
          )
        })}
      </nav>
      <div className="mt-auto p-4">
        <div className="rounded-lg border border-sidebar-border bg-background p-3 shadow-sm">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-muted-foreground">API</span>
            <Badge className="bg-emerald-600 text-white">{health?.status ?? 'offline'}</Badge>
          </div>
          <p className="break-all text-xs leading-5 text-muted-foreground">{apiBaseUrl}</p>
          <p className="mt-2 text-xs text-muted-foreground">DB {health?.db ?? '-'}</p>
        </div>
      </div>
    </div>
  )
}
