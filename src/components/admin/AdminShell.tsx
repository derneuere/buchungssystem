// Admin-Seitennavigation (Sidebar) + Logout + angezeigter Nutzername.
// Wird von der geschützten Layout-Route `src/routes/admin/_authenticated.tsx`
// um den jeweiligen Seiteninhalt (`<Outlet />`) gelegt.

import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useRouterState } from '@tanstack/react-router'
import {
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Landmark,
  LayoutDashboard,
  LineChart,
  LogOut,
  Settings,
  Sparkles,
  Users,
} from 'lucide-react'

import { pb } from '@/lib/pocketbase'
import type { Mitarbeiter } from '@/lib/types'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from '@/components/ui/sidebar'

const HAUPTNAVIGATION = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/admin/buchungen', label: 'Buchungen', icon: ClipboardList },
  { to: '/admin/auswertungen', label: 'Auswertungen', icon: LineChart },
]

const STAMMDATEN_NAVIGATION = [
  { to: '/admin/referenten', label: 'Referenten', icon: Users },
  { to: '/admin/verfuegbarkeiten', label: 'Verfügbarkeiten', icon: CalendarRange },
  { to: '/admin/themen', label: 'Themen', icon: Sparkles },
  { to: '/admin/angebotsarten', label: 'Angebotsarten', icon: CalendarClock },
  { to: '/admin/raeume', label: 'Räume', icon: Landmark },
  { to: '/admin/einrichtungstypen', label: 'Einrichtungstypen', icon: Landmark },
  { to: '/admin/schliesstage', label: 'Schließtage', icon: CalendarDays },
]

function useCurrentPath(): string {
  return useRouterState({ select: (s) => s.location.pathname })
}

function isActivePath(pathname: string, to: string, exact?: boolean): boolean {
  if (exact) return pathname === to
  return pathname === to || pathname.startsWith(`${to}/`)
}

export function AdminShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const pathname = useCurrentPath()
  const [loggingOut, setLoggingOut] = useState(false)
  const mitarbeiter = pb.authStore.record as Mitarbeiter | null

  function handleLogout() {
    setLoggingOut(true)
    pb.authStore.clear()
    navigate({ to: '/admin/login' })
  }

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <Landmark className="h-4 w-4" />
            </div>
            <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
              <span className="truncate text-sm font-semibold leading-tight">Buchungssystem</span>
              <span className="truncate text-xs text-muted-foreground leading-tight">
                Gedenkstätte Deutscher Widerstand
              </span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Übersicht</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {HAUPTNAVIGATION.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActivePath(pathname, item.to, item.exact)}
                      tooltip={item.label}
                    >
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Stammdaten</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {STAMMDATEN_NAVIGATION.map((item) => (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton asChild isActive={isActivePath(pathname, item.to)} tooltip={item.label}>
                      <Link to={item.to}>
                        <item.icon />
                        <span>{item.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>System</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={isActivePath(pathname, '/admin/einstellungen')}
                    tooltip="Einstellungen"
                  >
                    <Link to="/admin/einstellungen">
                      <Settings />
                      <span>Einstellungen</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <Separator className="mb-2" />
          <div className="flex items-center justify-between gap-2 px-1 group-data-[collapsible=icon]:flex-col">
            <div className="min-w-0 overflow-hidden group-data-[collapsible=icon]:hidden">
              <p className="truncate text-sm font-medium">{mitarbeiter?.name || mitarbeiter?.email || 'Personal'}</p>
              <p className="truncate text-xs text-muted-foreground">{mitarbeiter?.email}</p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              disabled={loggingOut}
              title="Abmelden"
              aria-label="Abmelden"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger />
          <Separator orientation="vertical" className="h-4" />
          <p className="text-sm font-medium text-muted-foreground">Admin-Panel</p>
        </header>
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
