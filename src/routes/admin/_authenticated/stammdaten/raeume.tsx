import { createFileRoute } from '@tanstack/react-router'
import { RaeumeTab } from '@/components/admin/stammdaten/RaeumeTab'

export const Route = createFileRoute('/admin/_authenticated/stammdaten/raeume')({
  component: RaeumeTab,
})
