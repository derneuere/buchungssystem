import { createFileRoute } from '@tanstack/react-router'
import { EinrichtungstypenTab } from '@/components/admin/stammdaten/EinrichtungstypenTab'

export const Route = createFileRoute('/admin/_authenticated/stammdaten/einrichtungstypen')({
  component: EinrichtungstypenTab,
})
