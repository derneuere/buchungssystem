// Stammdaten-Tab „Schließtage" (SPEC §2.3: `datum`, `grund`) — nur Anlegen und
// Löschen, kein Bearbeiten/Aktiv-Toggle.

import type { Dispatch, SetStateAction } from 'react'
import type { Schliesstag } from '@/lib/types'
import { adminKeys } from '@/lib/query'
import { formatDate } from '@/lib/admin-format'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { StammdatenCrud, type StammdatenConfig } from './StammdatenCrud'

type Form = { datum: string; grund: string }

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function FormFields({ form, setForm }: { form: Form; setForm: Dispatch<SetStateAction<Form>> }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="schliesstag-datum">Datum *</Label>
        <Input
          id="schliesstag-datum"
          type="date"
          value={form.datum}
          onChange={(e) => setForm((f) => ({ ...f, datum: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="schliesstag-grund">Grund</Label>
        <Input
          id="schliesstag-grund"
          value={form.grund}
          onChange={(e) => setForm((f) => ({ ...f, grund: e.target.value }))}
          placeholder="z.B. Weihnachtsfeiertage"
        />
      </div>
    </>
  )
}

const config: StammdatenConfig<Schliesstag, Form> = {
  collection: 'schliesstage',
  queryKey: adminKeys.stammdaten('schliesstage'),
  sort: 'datum',
  texte: {
    beschreibung: 'Feiertage und Betriebsurlaub — an diesen Tagen ist keine Buchung möglich.',
    neuButton: 'Neuer Schließtag',
    dialogNeu: 'Neuer Schließtag',
    leer: 'Noch keine Schließtage angelegt.',
    erstellt: 'Schließtag angelegt.',
    geloescht: 'Schließtag gelöscht.',
    speichernFehler: 'Speichern fehlgeschlagen. Existiert das Datum bereits?',
  },
  spalten: [
    { header: 'Datum', className: 'font-medium', render: (t) => formatDate(t.datum) },
    { header: 'Grund', className: 'text-muted-foreground', render: (t) => t.grund || '–' },
  ],
  emptyForm: () => ({ datum: todayKey(), grund: '' }),
  validate: (form) => (form.datum ? null : 'Bitte ein Datum angeben.'),
  toBody: (form) => ({
    datum: new Date(`${form.datum}T00:00:00`).toISOString(),
    grund: form.grund.trim() || undefined,
  }),
  FormFields,
  deleteTitle: (t) => `Schließtag ${formatDate(t.datum)} löschen?`,
}

export function SchliesstageTab() {
  return <StammdatenCrud config={config} />
}
