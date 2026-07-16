import { createFileRoute } from '@tanstack/react-router'
import { ThemenTab } from '@/components/admin/stammdaten/ThemenTab'

export const Route = createFileRoute('/admin/_authenticated/stammdaten/themen')({
  component: ThemenTab,
})
