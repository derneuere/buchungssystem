// Pathless Layout-Route (führendes `_`) für ALLE geschützten Admin-Seiten.
// Datei + gleichnamiges Verzeichnis `_authenticated/` bilden zusammen den
// TanStack-Router-Standardweg für einen Auth-Guard-Layout: Dateien unter
// `admin/_authenticated/*` werden hier durchgeleitet (Pfad-Präfix bleibt
// `/admin/...`, der Layout-Name selbst trägt nicht zur URL bei);
// `admin/login.tsx` liegt bewusst DANEBEN (nicht darunter) und bleibt
// dadurch von diesem Guard unberührt.
//
// Zusätzlich zum Auth-Guard erzwingt beforeLoad die RBAC-Sichtbarkeit
// (defense-in-depth; die harte Grenze bleibt das Backend). Die
// Auskunftsassistenz ('auskunft') darf nur die Buchungsliste/-detail und die
// Hilfe sehen; die Mitarbeiterverwaltung ist der Leitung vorbehalten.
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { isAuthenticated } from '@/lib/pocketbase'
import { aktuelleRolle } from '@/lib/use-rolle'
import { AdminShell } from '@/components/admin/AdminShell'

export const Route = createFileRoute('/admin/_authenticated')({
  beforeLoad: ({ location }) => {
    if (!isAuthenticated()) {
      throw redirect({ to: '/admin/login' })
    }
    const rolle = aktuelleRolle()
    const path = location.pathname

    // Auskunftsassistenz: nur Dashboard, Buchungsliste, Buchungsdetail und Hilfe.
    if (rolle === 'auskunft') {
      const erlaubt =
        path === '/admin' ||
        path === '/admin/buchungen' ||
        path === '/admin/hilfe' ||
        (path.startsWith('/admin/buchungen/') && path !== '/admin/buchungen/neu')
      if (!erlaubt) {
        throw redirect({ to: '/admin/buchungen' })
      }
    }

    // Mitarbeiterverwaltung nur für die Leitung.
    if (path === '/admin/mitarbeiter' && rolle !== 'leitung') {
      throw redirect({ to: '/admin' })
    }
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  return (
    <AdminShell>
      <Outlet />
    </AdminShell>
  )
}
