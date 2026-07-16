// Alt-URL /admin/einrichtungstypen → Stammdaten-Tab (Bookmarks bleiben gültig).
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/_authenticated/einrichtungstypen')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/stammdaten/einrichtungstypen', replace: true })
  },
})
