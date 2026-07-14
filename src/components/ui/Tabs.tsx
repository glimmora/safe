// ============================================================================
// components/ui/Tabs.tsx — Tab navigation
// ============================================================================

import { classNames } from '@/utils/helpers'

export interface Tab {
  id: string
  label: string
  count?: number
  icon?: React.ReactNode
}

export interface TabsProps {
  tabs: Tab[]
  active: string
  onChange: (id: string) => void
  className?: string
}

export function Tabs({ tabs, active, onChange, className }: TabsProps) {
  return (
    <div className={classNames('flex gap-1 border-b border-border', className)}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={classNames(
            'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all duration-200',
            'border-b-2 -mb-px',
            active === tab.id
              ? 'border-accent-blue text-text-primary'
              : 'border-transparent text-text-secondary hover:text-text-primary hover:border-border'
          )}
        >
          {tab.icon}
          {tab.label}
          {tab.count !== undefined && (
            <span className={classNames(
              'inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-md text-[10px] font-semibold',
              active === tab.id ? 'bg-accent-blue/20 text-accent-blue' : 'bg-bg-hover text-text-muted'
            )}>
              {tab.count}
            </span>
          )}
        </button>
      ))}
    </div>
  )
}
