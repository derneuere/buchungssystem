// Alt-URL /admin/kalender → Kalender-Ansicht der Buchungen-Route
// (Bookmarks inkl. ?ansicht=&datum= bleiben gültig).
import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'

const kalenderAltSchema = z.object({
  ansicht: z.enum(['monat', 'woche']).optional(),
  datum: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
})

export const Route = createFileRoute('/admin/_authenticated/kalender')({
  validateSearch: (search: Record<string, unknown>) => kalenderAltSchema.parse(search),
  beforeLoad: ({ search }) => {
    throw redirect({
      to: '/admin/buchungen',
      search: { ansicht: search.ansicht ?? 'monat', datum: search.datum },
      replace: true,
    })
  },
})
