// Pathless Layout-Route (führendes `_`) für ALLE geschützten Admin-Seiten.
// Datei + gleichnamiges Verzeichnis `_authenticated/` bilden zusammen den
// TanStack-Router-Standardweg für einen Auth-Guard-Layout: Dateien unter
// `admin/_authenticated/*` werden hier durchgeleitet (Pfad-Präfix bleibt
// `/admin/...`, der Layout-Name selbst trägt nicht zur URL bei);
// `admin/login.tsx` liegt bewusst DANEBEN (nicht darunter) und bleibt
// dadurch von diesem Guard unberührt.
import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { isAuthenticated } from '@/lib/pocketbase'
import { AdminShell } from '@/components/admin/AdminShell'

export const Route = createFileRoute('/admin/_authenticated')({
  beforeLoad: () => {
    if (!isAuthenticated()) {
      throw redirect({ to: '/admin/login' })
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
