// /admin/stammdaten — Layout-Route: ein gemeinsamer Kopf + Tab-Leiste für die
// fünf Stammdaten-Bereiche (Kind-Routen), Inhalt kommt über den <Outlet/>.

import { createFileRoute, Outlet } from '@tanstack/react-router'
import { RouteTabs } from '@/components/admin/shell/RouteTabs'

export const Route = createFileRoute('/admin/_authenticated/stammdaten')({
  component: StammdatenLayout,
})

function StammdatenLayout() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Stammdaten</h1>
        <p className="text-sm text-muted-foreground">
          Themen, Angebotsarten, Räume, Einrichtungstypen und Schließtage verwalten.
        </p>
      </div>
      <RouteTabs
        tabs={[
          { to: '/admin/stammdaten/themen', label: 'Themen' },
          { to: '/admin/stammdaten/angebotsarten', label: 'Angebotsarten' },
          { to: '/admin/stammdaten/raeume', label: 'Räume' },
          { to: '/admin/stammdaten/einrichtungstypen', label: 'Einrichtungstypen' },
          { to: '/admin/stammdaten/schliesstage', label: 'Schließtage' },
        ]}
      />
      <Outlet />
    </div>
  )
}
