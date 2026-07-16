// Generisches Stammdaten-CRUD: Tabelle + Dialog/Sheet-Formular + Lösch-Dialog
// mit Aktiv-Badge-Toggle. Ersetzt die vormals kopierten Einzelseiten; die
// konkreten Tabs (RaeumeTab, ThemenTab, …) liefern nur noch Konfiguration
// und Formularfelder.

import { useState, type ComponentType, type Dispatch, type ReactNode, type SetStateAction } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { pb } from '@/lib/pocketbase'
import { getDeleteErrorMessage, getErrorMessage } from '@/lib/admin-errors'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { ConfirmDeleteDialog } from '@/components/admin/shared/ConfirmDeleteDialog'

export interface StammdatenSpalte<T> {
  header: string
  className?: string
  render: (item: T) => ReactNode
}

export interface StammdatenConfig<T extends { id: string; aktiv?: boolean }, F> {
  collection: string
  queryKey: readonly unknown[]
  sort: string
  texte: {
    beschreibung: string
    neuButton: string
    dialogNeu: string
    dialogBearbeiten?: string
    leer: string
    erstellt: string
    aktualisiert?: string
    geloescht: string
    speichernFehler?: string
  }
  /** Ohne Status-/Aktionen-Spalte — die hängt die Komponente selbst an. */
  spalten: StammdatenSpalte<T>[]
  emptyForm: () => F
  /** Fehlt `toForm`, gibt es keinen Bearbeiten-Stift (z.B. Schließtage). */
  toForm?: (item: T) => F
  /** Fehlertext oder null; Fehler werden wie bisher als Toast gemeldet. */
  validate: (form: F) => string | null
  toBody: (form: F) => Record<string, unknown>
  /** Eigene Komponente, damit Editoren lokalen State halten können (Zeitslots). */
  FormFields: ComponentType<{ form: F; setForm: Dispatch<SetStateAction<F>> }>
  /** Status-Spalte mit klickbarem Aktiv-Badge (default: aus). */
  aktivToggle?: boolean
  editorVariante?: 'dialog' | 'sheet'
  deleteTitle: (item: T) => string
  deleteDescription?: (item: T) => string
  /** Gesetzt ⇒ getDeleteErrorMessage(err, …) für den Referenziert-Fehlerfall. */
  deleteFehlerRessource?: string
}

export function StammdatenCrud<T extends { id: string; aktiv?: boolean }, F>({
  config,
}: {
  config: StammdatenConfig<T, F>
}) {
  const {
    collection,
    queryKey,
    sort,
    texte,
    spalten,
    emptyForm,
    toForm,
    validate,
    toBody,
    FormFields,
    aktivToggle = false,
    editorVariante = 'dialog',
    deleteTitle,
    deleteDescription,
    deleteFehlerRessource,
  } = config

  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey,
    queryFn: () => pb.collection(collection).getFullList<T>({ sort }),
  })

  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<T | null>(null)
  const [form, setForm] = useState<F>(emptyForm())
  const [saving, setSaving] = useState(false)

  const spaltenGesamt = spalten.length + (aktivToggle ? 1 : 0) + 1

  function openCreate() {
    setEditing(null)
    setForm(emptyForm())
    setEditorOpen(true)
  }

  function openEdit(item: T) {
    if (!toForm) return
    setEditing(item)
    setForm(toForm(item))
    setEditorOpen(true)
  }

  function invalidate() {
    queryClient.invalidateQueries({ queryKey })
  }

  async function handleSubmit() {
    const fehler = validate(form)
    if (fehler) {
      toast.error(fehler)
      return
    }
    setSaving(true)
    try {
      const body = toBody(form)
      if (editing) {
        await pb.collection(collection).update(editing.id, body)
        toast.success(texte.aktualisiert ?? texte.erstellt)
      } else {
        await pb.collection(collection).create(body)
        toast.success(texte.erstellt)
      }
      setEditorOpen(false)
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, texte.speichernFehler ?? 'Speichern fehlgeschlagen.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: T) {
    try {
      await pb.collection(collection).delete(item.id)
      toast.success(texte.geloescht)
      invalidate()
    } catch (err) {
      toast.error(
        deleteFehlerRessource
          ? getDeleteErrorMessage(err, deleteFehlerRessource)
          : getErrorMessage(err, 'Löschen fehlgeschlagen.'),
      )
    }
  }

  async function handleToggleAktiv(item: T) {
    try {
      await pb.collection(collection).update(item.id, { aktiv: !item.aktiv })
      invalidate()
    } catch (err) {
      toast.error(getErrorMessage(err, 'Änderung fehlgeschlagen.'))
    }
  }

  const editorTitel = editing ? (texte.dialogBearbeiten ?? texte.dialogNeu) : texte.dialogNeu
  const editorFooter = (
    <>
      <Button variant="outline" onClick={() => setEditorOpen(false)} disabled={saving}>
        Abbrechen
      </Button>
      <Button onClick={handleSubmit} disabled={saving}>
        {saving && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        Speichern
      </Button>
    </>
  )

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{texte.beschreibung}</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          {texte.neuButton}
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                {spalten.map((s) => (
                  <TableHead key={s.header} className={s.className}>
                    {s.header}
                  </TableHead>
                ))}
                {aktivToggle && <TableHead>Status</TableHead>}
                <TableHead className="text-right">Aktionen</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.isLoading &&
                Array.from({ length: 3 }).map((_, i) => (
                  <TableRow key={i}>
                    <TableCell colSpan={spaltenGesamt}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}
              {!query.isLoading && (query.data?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell colSpan={spaltenGesamt} className="py-10 text-center text-sm text-muted-foreground">
                    {texte.leer}
                  </TableCell>
                </TableRow>
              )}
              {query.data?.map((item) => (
                <TableRow key={item.id}>
                  {spalten.map((s) => (
                    <TableCell key={s.header} className={s.className}>
                      {s.render(item)}
                    </TableCell>
                  ))}
                  {aktivToggle && (
                    <TableCell>
                      <button type="button" onClick={() => handleToggleAktiv(item)}>
                        <Badge variant={item.aktiv ? 'default' : 'secondary'} className="cursor-pointer">
                          {item.aktiv ? 'Aktiv' : 'Inaktiv'}
                        </Badge>
                      </button>
                    </TableCell>
                  )}
                  <TableCell className="text-right">
                    {toForm && (
                      <Button variant="ghost" size="icon" onClick={() => openEdit(item)} aria-label="Bearbeiten">
                        <Pencil className="h-4 w-4" />
                      </Button>
                    )}
                    <ConfirmDeleteDialog
                      trigger={
                        <Button variant="ghost" size="icon" aria-label="Löschen">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      }
                      title={deleteTitle(item)}
                      description={deleteDescription?.(item)}
                      onConfirm={() => handleDelete(item)}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {editorVariante === 'dialog' ? (
        <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editorTitel}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <FormFields form={form} setForm={setForm} />
            </div>
            <DialogFooter>{editorFooter}</DialogFooter>
          </DialogContent>
        </Dialog>
      ) : (
        <Sheet open={editorOpen} onOpenChange={setEditorOpen}>
          <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
            <SheetHeader>
              <SheetTitle>{editorTitel}</SheetTitle>
            </SheetHeader>
            <div className="space-y-4 py-4">
              <FormFields form={form} setForm={setForm} />
            </div>
            <SheetFooter>{editorFooter}</SheetFooter>
          </SheetContent>
        </Sheet>
      )}
    </div>
  )
}
