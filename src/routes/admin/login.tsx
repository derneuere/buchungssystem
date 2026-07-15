// /admin/login — einzige unauthentifiziert erreichbare Admin-Route.
// Bewusst AUSSERHALB der `_authenticated`-Layout-Route (siehe
// `src/routes/admin/_authenticated.tsx`), damit deren `beforeLoad`-Guard
// nicht greift und keine Redirect-Schleife entsteht.

import { useState } from 'react'
import { createFileRoute, redirect, useNavigate } from '@tanstack/react-router'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Landmark } from 'lucide-react'
import { toast } from 'sonner'

import { isAuthenticated, pb } from '@/lib/pocketbase'
import { getErrorMessage } from '@/lib/admin-errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/admin/login')({
  beforeLoad: () => {
    // Bereits angemeldet? Dann nicht nochmal den Login zeigen.
    if (isAuthenticated()) {
      throw redirect({ to: '/admin' })
    }
  },
  component: LoginPage,
})

const loginSchema = z.object({
  email: z.string().min(1, 'Bitte E-Mail-Adresse eingeben.').email('Bitte gültige E-Mail-Adresse eingeben.'),
  passwort: z.string().min(1, 'Bitte Passwort eingeben.'),
})

type LoginValues = z.infer<typeof loginSchema>

function LoginPage() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', passwort: '' },
  })

  async function onSubmit(values: LoginValues) {
    setSubmitting(true)
    try {
      // E-Mail normalisieren: der PocketBase-Login-Abgleich ist case- und
      // whitespace-sensitiv, gespeicherte Adressen sind kleingeschrieben. So
      // scheitert der Login nicht an iOS-Autokapitalisierung oder Autofill-
      // Leerzeichen (siehe Migration 0005 + Normalisierungs-Hook im Backend).
      const identity = values.email.trim().toLowerCase()
      await pb.collection('mitarbeiter').authWithPassword(identity, values.passwort)
      await navigate({ to: '/admin' })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Anmeldung fehlgeschlagen. Bitte E-Mail und Passwort prüfen.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Landmark className="h-5 w-5" />
          </div>
          <CardTitle>Admin-Anmeldung</CardTitle>
          <CardDescription>Gedenkstätte Deutscher Widerstand — Buchungssystem</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-2">
              <Label htmlFor="email">E-Mail</Label>
              <Input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                aria-invalid={!!errors.email}
                {...register('email')}
              />
              {errors.email && <p className="text-sm font-medium text-destructive">{errors.email.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="passwort">Passwort</Label>
              <Input
                id="passwort"
                type="password"
                autoComplete="current-password"
                aria-invalid={!!errors.passwort}
                {...register('passwort')}
              />
              {errors.passwort && <p className="text-sm font-medium text-destructive">{errors.passwort.message}</p>}
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Anmelden
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
