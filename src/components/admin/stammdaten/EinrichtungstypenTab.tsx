// Stammdaten-Tab „Einrichtungstypen" (SPEC §2.3) — Konfiguration für StammdatenCrud.

import type { Dispatch, SetStateAction } from 'react'
import type { Einrichtungstyp } from '@/lib/types'
import { adminKeys } from '@/lib/query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { StammdatenCrud, type StammdatenConfig } from './StammdatenCrud'

type Form = { name: string; name_en: string; sort_order: string; aktiv: boolean }

function FormFields({ form, setForm }: { form: Form; setForm: Dispatch<SetStateAction<Form>> }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="et-name">Name *</Label>
        <Input id="et-name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label htmlFor="et-name-en">Name (Englisch) — optional</Label>
        <Input
          id="et-name-en"
          value={form.name_en}
          onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          Wird in der englischen Buchungsansicht (?lang=en) angezeigt. Leer = deutscher Name.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="et-sort">Reihenfolge</Label>
        <Input
          id="et-sort"
          type="number"
          value={form.sort_order}
          onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
          className="w-32"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch id="et-aktiv" checked={form.aktiv} onCheckedChange={(v) => setForm((f) => ({ ...f, aktiv: v }))} />
        <Label htmlFor="et-aktiv" className="cursor-pointer font-normal">
          Aktiv (im öffentlichen Formular sichtbar)
        </Label>
      </div>
    </>
  )
}

const config: StammdatenConfig<Einrichtungstyp, Form> = {
  collection: 'einrichtungstypen',
  queryKey: adminKeys.stammdaten('einrichtungstypen'),
  sort: 'sort_order,name',
  texte: {
    beschreibung: 'Herkunfts-Einrichtungstypen (Schule, Universität, …).',
    neuButton: 'Neuer Einrichtungstyp',
    dialogNeu: 'Neuer Einrichtungstyp',
    dialogBearbeiten: 'Einrichtungstyp bearbeiten',
    leer: 'Noch keine Einrichtungstypen angelegt.',
    erstellt: 'Einrichtungstyp angelegt.',
    aktualisiert: 'Einrichtungstyp aktualisiert.',
    geloescht: 'Einrichtungstyp gelöscht.',
  },
  spalten: [
    { header: 'Name', className: 'font-medium', render: (e) => e.name },
    { header: 'Reihenfolge', render: (e) => e.sort_order ?? 0 },
  ],
  emptyForm: () => ({ name: '', name_en: '', sort_order: '0', aktiv: true }),
  toForm: (e) => ({
    name: e.name,
    name_en: e.name_en ?? '',
    sort_order: String(e.sort_order ?? 0),
    aktiv: e.aktiv,
  }),
  validate: (form) => (form.name.trim() ? null : 'Bitte einen Namen angeben.'),
  toBody: (form) => ({
    name: form.name.trim(),
    name_en: form.name_en.trim(),
    sort_order: Number(form.sort_order) || 0,
    aktiv: form.aktiv,
  }),
  FormFields,
  aktivToggle: true,
  deleteTitle: (e) => `„${e.name}" löschen?`,
  deleteDescription: () =>
    'Falls der Einrichtungstyp noch in Buchungen verwendet wird, schlägt das Löschen fehl — dann bitte stattdessen deaktivieren.',
  deleteFehlerRessource: 'Einrichtungstyp',
}

export function EinrichtungstypenTab() {
  return <StammdatenCrud config={config} />
}
