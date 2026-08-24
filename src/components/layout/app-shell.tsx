import { BarChart3, ChevronDown, CircleHelp, LogOut, Menu, RefreshCw, ScanSearch, Settings, Sparkles, WalletCards, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { SystemDataStatus, TradeRun } from '@/types'

// 保留旧视图字面量仅用于让尚未迁移的研究页面继续通过类型检查；导航不再入口这些页面。
export type View = 'overview' | 'workbench' | 'scan' | 'records' | 'rules' | 'settings' | 'runs' | 'plans' | 'fills' | 'performance' | 'comparison' | 'etfs' | 'audit'

const navItems: Array<{ key: View; label: string; icon: typeof BarChart3 }> = [
  { key: 'overview', label: '概览', icon: BarChart3 },
  { key: 'workbench', label: '当前交易', icon: Sparkles },
  { key: 'scan', label: '市场扫描', icon: ScanSearch },
  { key: 'records', label: '持仓与记录', icon: WalletCards },
  { key: 'rules', label: '交易规则', icon: CircleHelp },
  { key: 'settings', label: '设置', icon: Settings },
]

export function AppShell({ view, onViewChange, title, subtitle, health, runs, selectedRun, onRunChange, dataStatus, onRefresh, onLogout, children }: {
  view: View
  onViewChange: (view: View) => void
  title: string
  subtitle: string
  health: { status: string; db: string } | null
  runs: TradeRun[]
  selectedRun?: TradeRun
  onRunChange: (runId: number) => void
  dataStatus: SystemDataStatus | null
  onRefresh: () => void
  onLogout: () => void
  children: ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const Sidebar = () => (
    <aside className="flex h-full w-[272px] flex-col bg-white px-4 py-5 text-[#312C46] shadow-[8px_0_32px_rgba(63,52,104,.04)]">
      <div className="flex items-center gap-3 px-2 pb-8">
        <div className="grid size-11 place-items-center rounded-2xl bg-[#F1846D] text-white shadow-[0_10px_20px_rgba(241,132,109,.25)]"><Sparkles className="size-5" /></div>
        <div><p className="text-[15px] font-bold tracking-tight">今日交易</p><p className="mt-0.5 text-[11px] text-[#9490A5]">人工执行工作台</p></div>
      </div>
      <div className="rounded-2xl bg-[#FAF9FF] px-4 py-3.5">
        <p className="text-[11px] font-medium text-[#9490A5]">当前交易</p>
        <p className="mt-1 truncate text-sm font-semibold">{selectedRun?.name ?? '尚未选择'}</p>
        <p className="mt-1 text-xs text-[#9490A5]">{selectedRun ? runStatusLabel(selectedRun.status) : '等待真实数据'}</p>
      </div>
      <nav className="mt-7 space-y-1.5">{navItems.map(({ key, label, icon: Icon }) => (
        <button key={key} onClick={() => { onViewChange(key); setMobileOpen(false) }} className={cn('flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left text-sm font-medium transition', view === key ? 'bg-[#FFF0EC] text-[#D96651]' : 'text-[#706B80] hover:bg-[#F8F7FF] hover:text-[#312C46]')}>
          <Icon className="size-[18px]" strokeWidth={view === key ? 2.3 : 1.8} />{label}
        </button>
      ))}</nav>
      <div className="mt-auto rounded-2xl border border-[#EEEAF7] bg-[#FDFDFF] p-4">
        <div className="flex items-center gap-2"><span className={cn('size-2 rounded-full', health?.status === 'ok' ? 'bg-[#6CCBA7]' : 'bg-[#F6BD4F]')} /><p className="text-xs font-medium">{health?.status === 'ok' ? '服务已连接' : '正在连接服务'}</p></div>
        <p className="mt-2 text-[11px] leading-5 text-[#9490A5]">仅提供辅助判断，实际下单请在华泰证券完成。</p>
      </div>
    </aside>
  )
  return <div className="min-h-svh bg-[#F8F7FF] text-[#312C46]">
    <div className="fixed inset-y-0 left-0 z-30 hidden lg:block"><Sidebar /></div>
    {mobileOpen && <div className="fixed inset-0 z-50 lg:hidden"><button className="absolute inset-0 bg-[#312C46]/25" aria-label="关闭导航" onClick={() => setMobileOpen(false)} /><div className="absolute inset-y-0 left-0"><Sidebar /><button className="absolute right-4 top-5 grid size-8 place-items-center rounded-full bg-[#F8F7FF] text-[#706B80]" onClick={() => setMobileOpen(false)} aria-label="关闭导航"><X className="size-4" /></button></div></div>}
    <div className="lg:pl-[272px]"><header className="sticky top-0 z-20 border-b border-[#ECE9F5]/80 bg-[#F8F7FF]/90 px-5 py-4 backdrop-blur lg:px-9"><div className="flex items-center gap-3"><button className="grid size-10 place-items-center rounded-xl bg-white text-[#706B80] shadow-sm lg:hidden" aria-label="打开导航" onClick={() => setMobileOpen(true)}><Menu className="size-5" /></button><div className="min-w-0"><h1 className="text-xl font-bold tracking-tight">{title}</h1><p className="mt-0.5 truncate text-xs text-[#9490A5]">{subtitle}</p></div><div className="ml-auto flex items-center gap-2"><div className="hidden sm:block"><label className="sr-only" htmlFor="trade-run">选择当前交易</label><div className="relative"><select id="trade-run" value={selectedRun?.run_id ?? ''} onChange={event => event.target.value && onRunChange(Number(event.target.value))} className="h-10 max-w-56 appearance-none rounded-xl border border-[#E9E5F2] bg-white py-0 pl-3 pr-9 text-sm outline-none focus:border-[#F1846D]"> <option value="">选择当前交易</option>{runs.map(run => <option key={run.run_id} value={run.run_id}>{run.name}</option>)}</select><ChevronDown className="pointer-events-none absolute right-3 top-3 size-4 text-[#9490A5]" /></div></div><Button variant="ghost" size="icon" className="rounded-xl text-[#706B80] hover:bg-white" onClick={onRefresh} aria-label="刷新数据"><RefreshCw className="size-[18px]" /></Button><Button variant="ghost" size="sm" className="hidden rounded-xl text-[#706B80] hover:bg-white sm:inline-flex" onClick={onLogout}><LogOut />退出</Button></div></div>{dataStatus && <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#FFF8E8] px-3 py-2 text-xs leading-5 text-[#876316]"><span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#F6BD4F]" />{dataStatus.message}</div>}</header><main className="mx-auto max-w-[1480px] p-5 lg:p-9">{children}</main></div>
  </div>
}

export function runStatusLabel(status: TradeRun['status']) {
  return ({ draft: '尚未启动', running: '进行中', paused: '已暂停', ended: '已结束', deleted: '已删除' } as const)[status]
}

export const strategyLabels = { short_term: '短线', medium_term: '中线', long_term: '长线', swing: '波段', trend: '趋势', ic_optimized: 'IC 优化' } as const
export const strategyDescriptions = { short_term: '短线交易', medium_term: '中线交易', long_term: '长线交易', swing: '波段研究', trend: '趋势研究', ic_optimized: 'IC 优化研究' } as const
