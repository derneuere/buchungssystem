// /admin/stammdaten → erster Tab.
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/admin/_authenticated/stammdaten/')({
  beforeLoad: () => {
    throw redirect({ to: '/admin/stammdaten/themen', replace: true })
  },
})
