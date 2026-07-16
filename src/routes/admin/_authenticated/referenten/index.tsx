// /admin/referenten — Liste. Anlegen erzeugt einen Minimal-Datensatz und
// führt direkt zur Detailseite (Themen-Mehrfachauswahl + Verfügbarkeiten).

import { useState } from 'react'
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import type { Referent, Thema } from '@/lib/types'
import { getDeleteErrorMessage, getErrorMessage } from '@/lib/admin-errors'
import { istLeitung, useRolle } from '@/lib/use-rolle'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDeleteDialog } from '@/components/admin/shared/ConfirmDeleteDialog'

export const Route = createFileRoute('/admin/_authenticated/referenten/')({
  component: ReferentenListPage,
})

const QUERY_KEY = ['admin', 'referenten', 'alle']

// `Referent` (src/lib/types.ts) deklariert bewusst kein `expand`-Feld (anders
// als z.B. `Buchung`) — hier lokal ergänzt, um `expand=themen` typisiert
// auszulesen, ohne die gemeinsame Typdatei anzufassen.
type ReferentMitThemen = Referent & { expand?: { themen?: Thema[] } }

function ReferentenListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const darfBearbeiten = istLeitung(useRolle())

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => pb.collection('referenten').getFullList<ReferentMitThemen>({ sort: 'name', expand: 'themen' }),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }

  async function handleCreate() {
    if (!name.trim()) {
      toast.error('Bitte einen Namen angeben.')
      return
    }
    setSaving(true)
    try {
      const created = await pb.collection('referenten').create<Referent>({ name: name.trim(), aktiv: true })
      toast.success('Referent:in angelegt.')
      setDialogOpen(false)
      setName('')
      invalidate()
      navigate({ to: '/admin/referenten/$id', params: { id: created.id } })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Anlegen fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(referent: Referent) {
    try {
      await pb.collection('referenten').delete(referent.id)
      toast.success('Referent:in gelöscht.')
      invalidate()
    } catch (err) {
      toast.error(getDeleteErrorMessage(err, 'Referent:in'))
    }
  }

  async function handleToggleAktiv(referent: Referent) {
    try {
      await pb.collection('referenten').update(referent.id, { aktiv: !referent.aktiv })
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Änderung fehlgeschlagen.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Referent:innen</h1>
          <p className="text-sm text-muted-foreground">Stammdaten, Themenkompetenzen und Verfügbarkeiten.</p>
        </div>
        {darfBearbeiten && (
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Neue:r Referent:in
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Kontakt</TableHead>
                <TableHead>Themen</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={5}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!query.isLoading && (query.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                    Noch keine Referent:innen angelegt.
                  </TableCell>
                </TableRow>
              )}
              {query.data?.map((referent) => {
                const themenExpand = (referent.expand?.themen as Thema[] | undefined) ?? []
                return (
                  <TableRow key={referent.id}>
                    <TableCell>
                      <Link
                        to="/admin/referenten/$id"
                        params={{ id: referent.id }}
                        className="font-medium hover:underline"
                      >
                        {referent.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {referent.email || '–'}
                      {referent.telefon ? ` · ${referent.telefon}` : ''}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {themenExpand.length === 0 && <span className="text-sm text-muted-foreground">–</span>}
                        {themenExpand.slice(0, 3).map((t) => (
                          <Badge key={t.id} variant="outline" className="text-xs">
                            {t.name}
                          </Badge>
                        ))}
                        {themenExpand.length > 3 && (
                          <span className="text-xs text-muted-foreground">+{themenExpand.length - 3}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {darfBearbeiten ? (
                        <button type="button" onClick={() => handleToggleAktiv(referent)}>
                          <Badge variant={referent.aktiv ? 'default' : 'secondary'} className="cursor-pointer">
                            {referent.aktiv ? 'Aktiv' : 'Inaktiv'}
                          </Badge>
                        </button>
                      ) : (
                        <Badge variant={referent.aktiv ? 'default' : 'secondary'}>
                          {referent.aktiv ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {darfBearbeiten && (
                        <ConfirmDeleteDialog
                          trigger={
                            <Button variant="ghost" size="icon" aria-label="Löschen">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          }
                          title={`„${referent.name}" löschen?`}
                          description="Falls die Person noch in Buchungen oder Verfügbarkeiten referenziert wird, schlägt das Löschen fehl — dann bitte stattdessen deaktivieren."
                          onConfirm={() => handleDelete(referent)}
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
            <DialogTitle>Neue:r Referent:in</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="ref-name">Name *</Label>
            <Input id="ref-name" value={name} onChange={(e) => setName(e.target.value)} />
            <p className="text-xs text-muted-foreground">
              Weitere Angaben (Kontakt, Themen, Verfügbarkeiten) folgen auf der Detailseite.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleCreate} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Anlegen &amp; bearbeiten
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
