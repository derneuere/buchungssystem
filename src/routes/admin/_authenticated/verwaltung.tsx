// /admin/verwaltung — Layout-Route: Einstellungen, Mitarbeiter (nur Leitung)
// und Einbetten als Tabs (Kind-Routen), Inhalt kommt über den <Outlet/>.

import { createFileRoute, Outlet } from '@tanstack/react-router'
import { RouteTabs } from '@/components/admin/shell/RouteTabs'

export const Route = createFileRoute('/admin/_authenticated/verwaltung')({
  component: VerwaltungLayout,
})

function VerwaltungLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Verwaltung</h1>
        <p className="text-sm text-muted-foreground">
          Systemeinstellungen, Mitarbeiterkonten und Einbindung in die Webseite.
        </p>
      </div>
      <RouteTabs
        tabs={[
          { to: '/admin/verwaltung/einstellungen', label: 'Einstellungen' },
          { to: '/admin/verwaltung/mitarbeiter', label: 'Mitarbeiter', rollen: ['leitung'] },
          { to: '/admin/verwaltung/einbetten', label: 'Einbetten' },
        ]}
      />
      <Outlet />
    </div>
  )
}
