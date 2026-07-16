import { createFileRoute } from '@tanstack/react-router'
import { AngebotsartenTab } from '@/components/admin/stammdaten/AngebotsartenTab'

export const Route = createFileRoute('/admin/_authenticated/stammdaten/angebotsarten')({
  component: AngebotsartenTab,
})
