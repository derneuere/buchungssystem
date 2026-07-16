import { createFileRoute } from '@tanstack/react-router'
import { SchliesstageTab } from '@/components/admin/stammdaten/SchliesstageTab'

export const Route = createFileRoute('/admin/_authenticated/stammdaten/schliesstage')({
  component: SchliesstageTab,
})
