// Alt-URL /admin/schliesstage → Stammdaten-Tab (Bookmarks bleiben gültig).
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/_authenticated/schliesstage')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/stammdaten/schliesstage', replace: true })
  },
})
