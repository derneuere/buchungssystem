// Alt-URL /admin/angebotsarten → Stammdaten-Tab (Bookmarks bleiben gültig).
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/_authenticated/angebotsarten')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/stammdaten/angebotsarten', replace: true })
  },
})
