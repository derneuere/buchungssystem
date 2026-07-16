import { createFileRoute } from '@tanstack/react-router'
import { MitarbeiterVerwaltung } from '@/components/admin/verwaltung/MitarbeiterVerwaltung'

export const Route = createFileRoute('/admin/_authenticated/verwaltung/mitarbeiter')({
  component: MitarbeiterVerwaltung,
})
