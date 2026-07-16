// Verwaltungs-Tab „Mitarbeiter" (nur Leitung): Einladen per E-Mail (Eingeladene
// setzen Name + Passwort selbst über /admin/einladung), Liste mit Status,
// Widerrufen offener Einladungen. Der Einladungslink wird zusätzlich angezeigt
// (Fallback, falls kein SMTP konfiguriert ist).

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Copy, Loader2, Mail, Plus, RefreshCw, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import type { Mitarbeiter, Rolle } from '@/lib/types'
import { mitarbeiterEinladen } from '@/lib/api'
import { getDeleteErrorMessage, getErrorMessage } from '@/lib/admin-errors'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDeleteDialog } from '@/components/admin/shared/ConfirmDeleteDialog'

const QUERY_KEY = ['admin', 'mitarbeiter']

const ROLLE_LABEL: Record<string, string> = {
  mitarbeiter: 'Mitarbeiter',
  leitung: 'Leitung',
  auskunft: 'Auskunftsassistenz',
}

async function kopieren(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    toast.success('Link kopiert.')
  } catch {
    toast.error('Kopieren nicht möglich – bitte manuell markieren.')
  }
}

export function MitarbeiterVerwaltung() {
  const queryClient = useQueryClient()
  const meId = pb.authStore.record?.id
  const listQuery = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => pb.collection('mitarbeiter').getFullList<Mitarbeiter>({ sort: '-created' }),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [email, setEmail] = useState('')
  const [rolle, setRolle] = useState<Rolle>('mitarbeiter')
  const [saving, setSaving] = useState(false)
  const [letzterLink, setLetzterLink] = useState<string | null>(null)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }

  function openInvite() {
    setEmail('')
    setRolle('mitarbeiter')
    setLetzterLink(null)
    setDialogOpen(true)
  }

  async function einladen(inviteEmail: string, inviteRolle: Rolle) {
    setSaving(true)
    try {
      const res = await mitarbeiterEinladen({ email: inviteEmail.trim(), rolle: inviteRolle })
      setLetzterLink(res.link)
      toast.success('Einladung erstellt. Falls E-Mail konfiguriert ist, wurde sie versendet.')
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Einladung fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleInvite() {
    if (!email.trim()) {
      toast.error('Bitte eine E-Mail-Adresse angeben.')
      return
    }
    await einladen(email, rolle)
  }

  async function handleRevoke(m: Mitarbeiter) {
    try {
      await pb.collection('mitarbeiter').delete(m.id)
      toast.success('Eintrag entfernt.')
      invalidate()
    } catch (err) {
      toast.error(getDeleteErrorMessage(err, 'Mitarbeiter'))
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          Neue Mitarbeiter per E-Mail einladen – sie legen Name und Passwort selbst fest.
        </p>
        <Button onClick={openInvite}>
          <Plus className="h-4 w-4" />
          Mitarbeiter einladen
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>E-Mail</TableHead>
                <TableHead>Rolle</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {listQuery.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!listQuery.isLoading && (listQuery.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Noch keine Mitarbeiter.
                  </TableCell>
                </TableRow>
              )}
              {listQuery.data?.map((m) => {
                const eingeladen = !m.aktiv
                return (
                  <TableRow key={m.id}>
                    <TableCell className="font-medium">
                      {eingeladen ? (
                        <span className="text-muted-foreground">– (offen)</span>
                      ) : (
                        m.name || m.email
                      )}
                      {m.id === meId && <span className="ml-2 text-xs text-muted-foreground">(Sie)</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{m.email}</TableCell>
                    <TableCell>{ROLLE_LABEL[m.rolle] ?? m.rolle}</TableCell>
                    <TableCell>
                      <Badge variant={eingeladen ? 'secondary' : 'default'}>
                        {eingeladen ? 'Eingeladen' : 'Aktiv'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {eingeladen && (
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label="Erneut einladen"
                          title="Erneut einladen (neuer Link)"
                          disabled={saving}
                          onClick={() => einladen(m.email, (m.rolle as Rolle) || 'mitarbeiter')}
                        >
                          <RefreshCw className="h-4 w-4" />
                        </Button>
                      )}
                      {m.id !== meId && (
                        <ConfirmDeleteDialog
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Entfernen">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                          title={eingeladen ? 'Einladung widerrufen?' : `„${m.name || m.email}" entfernen?`}
                          description={
                            eingeladen
                              ? 'Der Einladungslink wird ungültig.'
                              : 'Das Konto wird entfernt. Auf sich selbst bezogene Konten können nicht gelöscht werden.'
                          }
                          onConfirm={() => handleRevoke(m)}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mitarbeiter einladen</DialogTitle>
            <DialogDescription>
              Die Person erhält (bei konfiguriertem E-Mail-Versand) einen Link, um Name und Passwort selbst
              festzulegen.
            </DialogDescription>
          </DialogHeader>

          {!letzterLink ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">E-Mail-Adresse *</Label>
                <Input
                  id="invite-email"
                  type="email"
                  placeholder="name@beispiel.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-rolle">Rolle</Label>
                <Select value={rolle} onValueChange={(v) => setRolle(v as Rolle)}>
                  <SelectTrigger id="invite-rolle">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mitarbeiter">Mitarbeiter</SelectItem>
                    <SelectItem value="leitung">Leitung</SelectItem>
                    <SelectItem value="auskunft">Auskunftsassistenz (nur Schalter)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-start gap-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
                <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <p className="text-muted-foreground">
                  Einladung erstellt. Falls kein E-Mail-Versand eingerichtet ist, teilen Sie diesen Link direkt
                  mit der Person (7 Tage gültig):
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Input readOnly value={letzterLink} className="font-mono text-xs" onFocus={(e) => e.target.select()} />
                <Button type="button" variant="outline" size="icon" aria-label="Link kopieren" onClick={() => kopieren(letzterLink)}>
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}

          <DialogFooter>
            {!letzterLink ? (
              <>
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
                  Abbrechen
                </Button>
                <Button onClick={handleInvite} disabled={saving}>
                  {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                  Einladung senden
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setLetzterLink(null)}>
                  Weitere einladen
                </Button>
                <Button onClick={() => setDialogOpen(false)}>Fertig</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
