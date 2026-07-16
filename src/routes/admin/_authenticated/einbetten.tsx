// Alt-URL /admin/einbetten → Verwaltungs-Tab (Bookmarks bleiben gültig).
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/_authenticated/einbetten')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/verwaltung/einbetten', replace: true })
  },
})
