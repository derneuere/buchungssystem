// Alt-URL /admin/marktueberblick → Unterseite der Hilfe (Bookmarks bleiben gültig).
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/_authenticated/marktueberblick')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/hilfe/marktueberblick', replace: true })
  },
})
