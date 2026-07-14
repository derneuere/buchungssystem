// /admin/schliesstage — Feiertage/Betriebsurlaub (SPEC §2.3: `datum`, `grund`).

import { useState } from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import type { Schliesstag } from '@/lib/types'
import { formatDate } from '@/lib/admin-format'
import { getErrorMessage } from '@/lib/admin-errors'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog'

export const Route = createFileRoute('/admin/_authenticated/schliesstage')({
  component: SchliesstagePage,
})

const QUERY_KEY = ['admin', 'schliesstage']

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function SchliesstagePage() {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => pb.collection('schliesstage').getFullList<Schliesstag>({ sort: 'datum' }),
  })

  const [dialogOpen, setDialogOpen] = useState(false)
  const [datum, setDatum] = useState(todayKey())
  const [grund, setGrund] = useState('')
  const [saving, setSaving] = useState(false)

  function openCreate() {
    setDatum(todayKey())
    setGrund('')
    setDialogOpen(true)
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY })
  }

  async function handleSubmit() {
    if (!datum) {
      toast.error('Bitte ein Datum angeben.')
      return
    }
    setSaving(true)
    try {
      await pb.collection('schliesstage').create({
        datum: new Date(`${datum}T00:00:00`).toISOString(),
        grund: grund.trim() || undefined,
      })
      toast.success('Schließtag angelegt.')
      setDialogOpen(false)
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Speichern fehlgeschlagen. Existiert das Datum bereits?'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(tag: Schliesstag) {
    try {
      await pb.collection('schliesstage').delete(tag.id)
      toast.success('Schließtag gelöscht.')
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Löschen fehlgeschlagen.'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schließtage</h1>
          <p className="text-sm text-muted-foreground">Feiertage und Betriebsurlaub — an diesen Tagen ist keine Buchung möglich.</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          Neuer Schließtag
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Datum</TableHead>
                <TableHead>Grund</TableHead>
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={3}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!query.isLoading && (query.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={3} className="py-10 text-center text-sm text-muted-foreground">
                    Noch keine Schließtage angelegt.
                  </TableCell>
                </TableRow>
              )}
              {query.data?.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell className="font-medium">{formatDate(tag.datum)}</TableCell>
                  <TableCell className="text-muted-foreground">{tag.grund || '–'}</TableCell>
                  <TableCell className="text-right">
                    <ConfirmDeleteDialog
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Löschen">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                      title={`Schließtag ${formatDate(tag.datum)} löschen?`}
                      onConfirm={() => handleDelete(tag)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Neuer Schließtag</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="schliesstag-datum">Datum *</Label>
              <Input id="schliesstag-datum" type="date" value={datum} onChange={(e) => setDatum(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="schliesstag-grund">Grund</Label>
              <Input
                id="schliesstag-grund"
                value={grund}
                onChange={(e) => setGrund(e.target.value)}
                placeholder="z.B. Weihnachtsfeiertage"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={saving}>
              Abbrechen
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
              Speichern
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
