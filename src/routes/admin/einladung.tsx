// /admin/einladung — öffentliche Route (KEIN Auth-Guard, bewusst neben
// _authenticated), auf der eingeladene Mitarbeiter über einen E-Mail-Token
// ihren Namen und ihr Passwort festlegen und ihr Konto aktivieren.

import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { Landmark, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { einladungAnnehmen, einladungPruefen } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/admin/einladung')({
  validateSearch: (search: Record<string, unknown>) => ({
    id: typeof search.id === 'string' ? search.id : '',
    token: typeof search.token === 'string' ? search.token : '',
  }),
  component: EinladungPage,
})

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-sm">
        <CardHeader className="items-center text-center">
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Landmark className="h-5 w-5" />
          </div>
          <CardTitle>Einladung annehmen</CardTitle>
          <CardDescription>Gedenkstätte Deutscher Widerstand — Buchungssystem</CardDescription>
        </CardHeader>
        <CardContent>{children}</CardContent>
      </Card>
    </div>
  )
}

function EinladungPage() {
  const { id, token } = Route.useSearch()
  const navigate = useNavigate()

  const check = useQuery({
    queryKey: ['einladung', id, token],
    queryFn: () => einladungPruefen({ id, token }),
    enabled: !!id && !!token,
    retry: false,
  })

  const [name, setName] = useState('')
  const [passwort, setPasswort] = useState('')
  const [passwort2, setPasswort2] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('Bitte einen Namen angeben.')
      return
    }
    if (passwort.length < 8) {
      toast.error('Das Passwort muss mindestens 8 Zeichen lang sein.')
      return
    }
    if (passwort !== passwort2) {
      toast.error('Die Passwörter stimmen nicht überein.')
      return
    }
    setSubmitting(true)
    try {
      await einladungAnnehmen({ id, token, name: name.trim(), password: passwort })
      toast.success('Konto aktiviert. Sie können sich jetzt anmelden.')
      await navigate({ to: '/admin/login' })
    } catch {
      toast.error('Die Einladung ist ungültig oder abgelaufen.')
    } finally {
      setSubmitting(false)
    }
  }

  if (!id || !token) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          Dieser Einladungslink ist unvollständig. Bitte verwenden Sie den Link aus Ihrer E-Mail.
        </p>
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link to="/admin/login">Zur Anmeldung</Link>
        </Button>
      </Shell>
    )
  }

  if (check.isLoading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-6 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        </div>
      </Shell>
    )
  }

  if (!check.data?.valid) {
    return (
      <Shell>
        <p className="text-sm text-muted-foreground">
          Diese Einladung ist ungültig oder abgelaufen. Bitte fordern Sie eine neue Einladung an.
        </p>
        <Button asChild variant="outline" className="mt-4 w-full">
          <Link to="/admin/login">Zur Anmeldung</Link>
        </Button>
      </Shell>
    )
  }

  return (
    <Shell>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-2">
          <Label>E-Mail</Label>
          <Input value={check.data.email ?? ''} readOnly disabled />
        </div>
        <div className="space-y-2">
          <Label htmlFor="einladung-name">Ihr Name *</Label>
          <Input
            id="einladung-name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="einladung-pw">Passwort *</Label>
          <Input
            id="einladung-pw"
            type="password"
            autoComplete="new-password"
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">Mindestens 8 Zeichen.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="einladung-pw2">Passwort wiederholen *</Label>
          <Input
            id="einladung-pw2"
            type="password"
            autoComplete="new-password"
            value={passwort2}
            onChange={(e) => setPasswort2(e.target.value)}
          />
        </div>
        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
          Konto aktivieren
        </Button>
      </form>
    </Shell>
  )
}
