import { createFileRoute } from '@tanstack/react-router'
import { EinbettenAnleitung } from '@/components/admin/verwaltung/EinbettenAnleitung'

export const Route = createFileRoute('/admin/_authenticated/verwaltung/einbetten')({
  component: EinbettenAnleitung,
})
