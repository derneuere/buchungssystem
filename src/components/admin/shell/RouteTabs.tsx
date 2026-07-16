// Tab-Leiste in shadcn-Tabs-Optik, aber aus Router-Links: die "Tabs" sind
// Kind-Routen (z.B. /admin/stammdaten/raeume), der Inhalt ist der <Outlet/>
// der Layout-Route. Rollen-Filterung wie in der Sidebar (sichtbarFuer).

import { Link, useRouterState } from '@tanstack/react-router'
import { useRolle } from '@/lib/use-rolle'
import { cn } from '@/lib/utils'
import type { Rolle } from '@/lib/types'

export interface RouteTab {
  to: string
  label: string
  /** Ohne Angabe: für alle Rollen sichtbar. */
  rollen?: Rolle[]
}

export function RouteTabs({ tabs }: { tabs: RouteTab[] }) {
  const rolle = useRolle()
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const sichtbar = tabs.filter((t) => !t.rollen || (rolle != null && t.rollen.includes(rolle)))

  return (
    <div className="inline-flex h-10 max-w-full items-center justify-start gap-0 overflow-x-auto rounded-md bg-muted p-1 text-muted-foreground">
      {sichtbar.map((tab) => {
        const active = pathname === tab.to || pathname.startsWith(`${tab.to}/`)
        return (
          <Link
            key={tab.to}
            to={tab.to}
            className={cn(
              'inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
              active && 'bg-background text-foreground shadow-sm',
            )}
          >
            {tab.label}
          </Link>
        )
      })}
    </div>
  )
}
