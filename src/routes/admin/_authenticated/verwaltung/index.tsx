// /admin/verwaltung → erster Tab.
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/_authenticated/verwaltung/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/verwaltung/einstellungen', replace: true })
  },
})
