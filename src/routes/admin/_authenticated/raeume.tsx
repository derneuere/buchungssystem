// Alt-URL /admin/raeume → Stammdaten-Tab (Bookmarks bleiben gültig).
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/_authenticated/raeume')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/stammdaten/raeume', replace: true })
  },
})
