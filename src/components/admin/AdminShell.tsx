// Admin-Layout: robustes Flex-Layout (Sidebar-Spalte + Content daneben, kein
// Overlap) mit Off-Canvas-Navigation (Sheet) auf Mobilgeräten. Wird von der
// geschützten Layout-Route `src/routes/admin/_authenticated.tsx` um den
// jeweiligen Seiteninhalt (`<Outlet />`) gelegt.

import { useState, type ComponentType, type ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  CalendarClock,
  CalendarDays,
  ClipboardList,
  Code2,
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
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import type { Mitarbeiter, Rolle } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useTestStatus, TEST_STATUS_KEY } from '@/lib/use-test-mode'
import { useRolle } from '@/lib/use-rolle'
import { testResetRolle } from '@/lib/api'
import { getErrorMessage } from '@/lib/admin-errors'
import { Button } from '@/components/ui/button'
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'

type NavItem = {
  to: string
  label: string
  icon: ComponentType<{ className?: string }>
  exact?: boolean
  /** Sichtbar für diese Rollen; ohne Angabe für alle sichtbar. */
  rollen?: Rolle[]
}

const PERSONAL: Rolle[] = ['leitung', 'mitarbeiter']
const NUR_LEITUNG: Rolle[] = ['leitung']

const ROLLE_LABEL: Record<Rolle, string> = {
  leitung: 'Leitung',
  mitarbeiter: 'Mitarbeiter',
  auskunft: 'Auskunftsassistenz',
}

const HAUPTNAVIGATION: NavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true }, // alle drei Rollen
  { to: '/admin/buchungen', label: 'Buchungen', icon: ClipboardList }, // alle drei Rollen
  { to: '/admin/auswertungen', label: 'Auswertungen', icon: LineChart, rollen: PERSONAL },
]

const STAMMDATEN_NAVIGATION: NavItem[] = [
  { to: '/admin/referenten', label: 'Referenten', icon: Users, rollen: PERSONAL },
  { to: '/admin/themen', label: 'Themen', icon: Sparkles, rollen: PERSONAL },
  { to: '/admin/angebotsarten', label: 'Angebotsarten', icon: CalendarClock, rollen: PERSONAL },
  { to: '/admin/raeume', label: 'Räume', icon: Landmark, rollen: PERSONAL },
  { to: '/admin/einrichtungstypen', label: 'Einrichtungstypen', icon: Landmark, rollen: PERSONAL },
  { to: '/admin/schliesstage', label: 'Schließtage', icon: CalendarDays, rollen: PERSONAL },
]

const SYSTEM_NAVIGATION: NavItem[] = [
  { to: '/admin/mitarbeiter', label: 'Mitarbeiter', icon: UserPlus, rollen: NUR_LEITUNG },
  { to: '/admin/einbetten', label: 'Einbetten', icon: Code2, rollen: PERSONAL },
  { to: '/admin/hilfe', label: 'Hilfe', icon: BookOpen }, // alle drei Rollen
  { to: '/admin/einstellungen', label: 'Einstellungen', icon: Settings, rollen: PERSONAL },
]

function sichtbarFuer(items: NavItem[], rolle: Rolle | null): NavItem[] {
  return items.filter((i) => !i.rollen || (rolle != null && i.rollen.includes(rolle)))
}

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
  rolle,
  loggingOut,
  onLogout,
  onNavigate,
  hauptItems,
  stammItems,
  systemItems,
}: {
  pathname: string
  mitarbeiter: Mitarbeiter | null
  rolle: Rolle | null
  loggingOut: boolean
  onLogout: () => void
  onNavigate?: () => void
  hauptItems: NavItem[]
  stammItems: NavItem[]
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
        {hauptItems.length > 0 && (
          <NavGroup label="Übersicht" items={hauptItems} pathname={pathname} onNavigate={onNavigate} />
        )}
        {stammItems.length > 0 && (
          <NavGroup label="Stammdaten" items={stammItems} pathname={pathname} onNavigate={onNavigate} />
        )}
        {systemItems.length > 0 && (
          <NavGroup label="System" items={systemItems} pathname={pathname} onNavigate={onNavigate} />
        )}
      </div>
      <div className="border-t p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {mitarbeiter?.name || mitarbeiter?.email || 'Personal'}
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {rolle ? ROLLE_LABEL[rolle] : mitarbeiter?.email}
            </p>
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
  const queryClient = useQueryClient()
  const pathname = useCurrentPath()
  const [loggingOut, setLoggingOut] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [resettingRolle, setResettingRolle] = useState(false)
  const mitarbeiter = pb.authStore.record as Mitarbeiter | null
  const rolle = useRolle()

  // QA-/Testmodus: Nav-Eintrag nur, wenn der Server mit TEST_MODE läuft; Banner
  // zusätzlich nur, wenn gerade ein simuliertes Datum aktiv ist. Ohne TEST_MODE
  // liefert die Status-Route 404 → `test` bleibt undefined → alles unsichtbar.
  const { data: test } = useTestStatus()
  // QA-Seite nur für Personal (leitung/mitarbeiter) im Menü; wird auf 'auskunft'
  // simuliert, verschwindet sie — der Reset läuft dann über den QA-Balken.
  const systemBasis = sichtbarFuer(SYSTEM_NAVIGATION, rolle)
  const systemNav: NavItem[] =
    test?.test_mode && (rolle === 'leitung' || rolle === 'mitarbeiter')
      ? [...systemBasis, { to: '/admin/test', label: 'QA / Testmodus', icon: FlaskConical }]
      : systemBasis
  const hauptNav = sichtbarFuer(HAUPTNAVIGATION, rolle)
  const stammNav = sichtbarFuer(STAMMDATEN_NAVIGATION, rolle)

  function handleLogout() {
    setLoggingOut(true)
    pb.authStore.clear()
    navigate({ to: '/admin/login' })
  }

  async function handleRolleReset() {
    setResettingRolle(true)
    try {
      await testResetRolle()
      // authStore muss die echte Rolle wieder sehen.
      await pb.collection('mitarbeiter').authRefresh()
      queryClient.invalidateQueries({ queryKey: TEST_STATUS_KEY })
      queryClient.invalidateQueries({ queryKey: ['admin'] })
      toast.success('Auf echte Rolle zurückgesetzt.')
      navigate({ to: '/admin' })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Zurücksetzen fehlgeschlagen.'))
    } finally {
      setResettingRolle(false)
    }
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      {/* Desktop: feste Sidebar-Spalte, Content liegt daneben (kein Overlap) */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 border-r bg-card md:block">
        <SidebarBody
          pathname={pathname}
          mitarbeiter={mitarbeiter}
          rolle={rolle}
          loggingOut={loggingOut}
          onLogout={handleLogout}
          hauptItems={hauptNav}
          stammItems={stammNav}
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
                rolle={rolle}
                loggingOut={loggingOut}
                onLogout={() => {
                  setMobileOpen(false)
                  handleLogout()
                }}
                onNavigate={() => setMobileOpen(false)}
                hauptItems={hauptNav}
                stammItems={stammNav}
                systemItems={systemNav}
              />
            </SheetContent>
          </Sheet>
          <span className="text-sm font-semibold">Admin-Panel</span>
        </header>

        {/* QA-Rollen-Balken: rollenunabhängig, damit der Reset auch als
            simulierte 'auskunft' (ohne QA-Menüeintrag) immer erreichbar ist. */}
        {test?.test_mode && test?.rolle_override_aktiv && (
          <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 bg-violet-600 px-4 py-1.5 text-center text-sm font-medium text-white">
            <span>
              <FlaskConical className="mr-1 inline h-4 w-4" aria-hidden="true" />
              Simulierte Rolle: {rolle ? ROLLE_LABEL[rolle] : '—'}
              {test.qa_rolle_original ? ` (echt: ${ROLLE_LABEL[test.qa_rolle_original as Rolle] ?? test.qa_rolle_original})` : ''}
            </span>
            <button
              type="button"
              onClick={handleRolleReset}
              disabled={resettingRolle}
              className="underline underline-offset-2 disabled:opacity-60"
            >
              Zurücksetzen
            </button>
          </div>
        )}

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
