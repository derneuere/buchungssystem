import { createFileRoute } from '@tanstack/react-router'
import { EinstellungenForm } from '@/components/admin/verwaltung/EinstellungenForm'

export const Route = createFileRoute('/admin/_authenticated/verwaltung/einstellungen')({
  component: EinstellungenForm,
})
