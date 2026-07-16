// Stammdaten-Tab „Räume" (SPEC §2.3) — Konfiguration für StammdatenCrud.

import type { Dispatch, SetStateAction } from 'react'
import type { Raum } from '@/lib/types'
import { adminKeys } from '@/lib/query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { StammdatenCrud, type StammdatenConfig } from './StammdatenCrud'

type Form = { name: string; kapazitaet: string; notizen: string; aktiv: boolean }

function FormFields({ form, setForm }: { form: Form; setForm: Dispatch<SetStateAction<Form>> }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="raum-name">Name *</Label>
        <Input
          id="raum-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="raum-kapazitaet">Kapazität *</Label>
        <Input
          id="raum-kapazitaet"
          type="number"
          min={1}
          value={form.kapazitaet}
          onChange={(e) => setForm((f) => ({ ...f, kapazitaet: e.target.value }))}
          className="w-32"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="raum-notizen">Notizen</Label>
        <Textarea
          id="raum-notizen"
          rows={3}
          value={form.notizen}
          onChange={(e) => setForm((f) => ({ ...f, notizen: e.target.value }))}
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="raum-aktiv"
          checked={form.aktiv}
          onCheckedChange={(v) => setForm((f) => ({ ...f, aktiv: v }))}
        />
        <Label htmlFor="raum-aktiv" className="cursor-pointer font-normal">
          Aktiv (für Raumvergabe verfügbar)
        </Label>
      </div>
    </>
  )
}

const config: StammdatenConfig<Raum, Form> = {
  collection: 'raeume',
  queryKey: adminKeys.stammdaten('raeume'),
  sort: 'name',
  texte: {
    beschreibung: 'Räume für Seminare inkl. Kapazität.',
    neuButton: 'Neuer Raum',
    dialogNeu: 'Neuer Raum',
    dialogBearbeiten: 'Raum bearbeiten',
    leer: 'Noch keine Räume angelegt.',
    erstellt: 'Raum angelegt.',
    aktualisiert: 'Raum aktualisiert.',
    geloescht: 'Raum gelöscht.',
  },
  spalten: [
    { header: 'Name', className: 'font-medium', render: (r) => r.name },
    { header: 'Kapazität', render: (r) => r.kapazitaet },
    {
      header: 'Notizen',
      className: 'max-w-xs truncate text-muted-foreground',
      render: (r) => r.notizen || '–',
    },
  ],
  emptyForm: () => ({ name: '', kapazitaet: '1', notizen: '', aktiv: true }),
  toForm: (r) => ({
    name: r.name,
    kapazitaet: String(r.kapazitaet),
    notizen: r.notizen ?? '',
    aktiv: r.aktiv,
  }),
  validate: (form) => {
    if (!form.name.trim()) return 'Bitte einen Namen angeben.'
    const kapazitaet = Number(form.kapazitaet)
    if (!Number.isFinite(kapazitaet) || kapazitaet < 1) return 'Bitte eine gültige Kapazität (mind. 1) angeben.'
    return null
  },
  toBody: (form) => ({
    name: form.name.trim(),
    kapazitaet: Number(form.kapazitaet),
    notizen: form.notizen.trim() || undefined,
    aktiv: form.aktiv,
  }),
  FormFields,
  aktivToggle: true,
  deleteTitle: (r) => `„${r.name}" löschen?`,
  deleteDescription: () =>
    'Falls der Raum noch in Buchungen verwendet wird, schlägt das Löschen fehl — dann bitte stattdessen deaktivieren.',
  deleteFehlerRessource: 'Raum',
}

export function RaeumeTab() {
  return <StammdatenCrud config={config} />
}
