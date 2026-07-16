// Alt-URL /admin/mitarbeiter → Verwaltungs-Tab (Bookmarks bleiben gültig).
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/_authenticated/mitarbeiter')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/verwaltung/mitarbeiter', replace: true })
  },
})
