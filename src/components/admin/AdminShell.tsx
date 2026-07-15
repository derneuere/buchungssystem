// Admin-Layout: robustes Flex-Layout (Sidebar-Spalte + Content daneben, kein
// Overlap) mit Off-Canvas-Navigation (Sheet) auf Mobilgeräten. Wird von der
// geschützten Layout-Route `src/routes/admin/_authenticated.tsx` um den
// jeweiligen Seiteninhalt (`<Outlet />`) gelegt.

import { useState, type ComponentType, type ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Code2,
  FilePlus,
  FlaskConical,
  Landmark,
  LayoutDashboard,
  LineChart,
  LogOut,
  Menu,
  Settings,
  Sparkles,
  UserPlus,
  Users,
} from 'lucide-react'

import { pb } from '@/lib/pocketbase'
import type { Mitarbeiter } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useTestStatus } from '@/lib/use-test-mode'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type NavItem = {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  exact?: boolean
}

const HAUPTNAVIGATION: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/buchungen', label: 'Buchungen', icon: ClipboardList },
  { to: '/admin/buchungen/neu', label: 'Neue Buchung', icon: FilePlus, exact: true },
  { to: '/admin/auswertungen', label: 'Auswertungen', icon: LineChart },
]

const STAMMDATEN_NAVIGATION: NavItem[] = [
  { to: '/admin/referenten', label: 'Referenten', icon: Users },
  { to: '/admin/verfuegbarkeiten', label: 'Verfügbarkeiten', icon: CalendarRange },
  { to: '/admin/themen', label: 'Themen', icon: Sparkles },
  { to: '/admin/angebotsarten', label: 'Angebotsarten', icon: CalendarClock },
  { to: '/admin/raeume', label: 'Räume', icon: Landmark },
  { to: '/admin/einrichtungstypen', label: 'Einrichtungstypen', icon: Landmark },
  { to: '/admin/schliesstage', label: 'Schließtage', icon: CalendarDays },
]

const SYSTEM_NAVIGATION: NavItem[] = [
  { to: '/admin/mitarbeiter', label: 'Mitarbeiter', icon: UserPlus },
  { to: '/admin/einbetten', label: 'Einbetten', icon: Code2 },
  { to: '/admin/hilfe', label: 'Hilfe', icon: BookOpen },
  { to: '/admin/einstellungen', label: 'Einstellungen', icon: Settings },
]

function useCurrentPath(): string {
  return useRouterState({ select: (s) => s.location.pathname })
}

function isActivePath(pathname: string, to: string, exact?: boolean): boolean {
  if (exact) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

function NavGroup({
  label,
  items,
  pathname,
  onNavigate,
}: {
  label: string
  items: NavItem[]
  pathname: string
  onNavigate?: () => void
}) {
  return (
    <div className="px-2 py-2">
      <p className="px-2 pb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <nav className="flex flex-col gap-0.5">
        {items.map((item) => {
          const active = isActivePath(pathname, item.to, item.exact)
          return (
            <Link
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex items-center gap-2 rounded-md px-2 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground',
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

function SidebarBody({
  pathname,
  mitarbeiter,
  loggingOut,
  onLogout,
  onNavigate,
  systemItems,
}: {
  pathname: string
  mitarbeiter: Mitarbeiter | null
  loggingOut: boolean
  onLogout: () => void
  onNavigate?: () => void
  systemItems: NavItem[]
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Landmark className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Buchungssystem</p>
          <p className="truncate text-xs text-muted-foreground leading-tight">
            Gedenkstätte Deutscher Widerstand
          </p>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <NavGroup label="Übersicht" items={HAUPTNAVIGATION} pathname={pathname} onNavigate={onNavigate} />
        <NavGroup label="Stammdaten" items={STAMMDATEN_NAVIGATION} pathname={pathname} onNavigate={onNavigate} />
        <NavGroup label="System" items={systemItems} pathname={pathname} onNavigate={onNavigate} />
      </div>
      <div className="border-t p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {mitarbeiter?.name || mitarbeiter?.email || 'Personal'}
            </p>
            <p className="truncate text-xs text-muted-foreground">{mitarbeiter?.email}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onLogout}
            disabled={loggingOut}
            title="Abmelden"
            aria-label="Abmelden"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const pathname = useCurrentPath()
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const mitarbeiter = pb.authStore.record as Mitarbeiter | null

  // QA-/Testmodus: Nav-Eintrag nur, wenn der Server mit TEST_MODE läuft; Banner
  // zusätzlich nur, wenn gerade ein simuliertes Datum aktiv ist. Ohne TEST_MODE
  // liefert die Status-Route 404 → `test` bleibt undefined → alles unsichtbar.
  const { data: test } = useTestStatus()
  const systemNav: NavItem[] = test?.test_mode
    ? [...SYSTEM_NAVIGATION, { to: '/admin/test', label: 'QA / Testmodus', icon: FlaskConical }]
    : SYSTEM_NAVIGATION

  function handleLogout() {
    setLoggingOut(true)
    pb.authStore.clear()
    navigate({ to: '/admin/login' })
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop: feste Sidebar-Spalte, Content liegt daneben (kein Overlap) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-card md:block">
        <SidebarBody
          pathname={pathname}
          mitarbeiter={mitarbeiter}
          loggingOut={loggingOut}
          onLogout={handleLogout}
          systemItems={systemNav}
        />
      </aside>

      {/* Hauptspalte */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile: obere Leiste mit Off-Canvas-Navigation */}
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur md:hidden">
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label="Navigation öffnen">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SidebarBody
                pathname={pathname}
                mitarbeiter={mitarbeiter}
                loggingOut={loggingOut}
                onLogout={() => {
                  setMobileOpen(false)
                  handleLogout()
                }}
                onNavigate={() => setMobileOpen(false)}
                systemItems={systemNav}
              />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-semibold">Admin-Panel</span>
        </header>

        {/* QA-Banner: nur bei aktiv simuliertem Datum. */}
        {test?.aktiv && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-amber-500 px-4 py-1.5 text-center text-sm font-medium text-amber-950">
            <span>
              <FlaskConical className="mr-1 inline h-4 w-4" aria-hidden="true" />
              Simuliertes Datum aktiv: {test.jetzt_berlin} Uhr
            </span>
            <Link to="/admin/test" className="underline underline-offset-2">
              verwalten
            </Link>
          </div>
        )}

        <main className="min-w-0 flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
