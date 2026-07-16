// Stammdaten-Tab „Themen" (SPEC §5.2) — Konfiguration für StammdatenCrud.

import type { Dispatch, SetStateAction } from 'react'
import type { Thema } from '@/lib/types'
import { adminKeys } from '@/lib/query'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { StammdatenCrud, type StammdatenConfig } from './StammdatenCrud'

type Form = {
  name: string
  name_en: string
  beschreibung: string
  beschreibung_en: string
  sort_order: string
  aktiv: boolean
}

function FormFields({ form, setForm }: { form: Form; setForm: Dispatch<SetStateAction<Form>> }) {
  return (
    <>
      <div className="space-y-2">
        <Label htmlFor="thema-name">Name *</Label>
        <Input
          id="thema-name"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="thema-name-en">Name (Englisch) — optional</Label>
        <Input
          id="thema-name-en"
          value={form.name_en}
          onChange={(e) => setForm((f) => ({ ...f, name_en: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">
          Wird in der englischen Buchungsansicht (?lang=en) angezeigt. Leer = deutscher Name.
        </p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="thema-beschreibung">Beschreibung</Label>
        <Textarea
          id="thema-beschreibung"
          rows={3}
          value={form.beschreibung}
          onChange={(e) => setForm((f) => ({ ...f, beschreibung: e.target.value }))}
        />
        <p className="text-xs text-muted-foreground">Wird öffentlich im Buchungsformular angezeigt.</p>
      </div>
      <div className="space-y-2">
        <Label htmlFor="thema-beschreibung-en">Beschreibung (Englisch) — optional</Label>
        <Textarea
          id="thema-beschreibung-en"
          rows={3}
          value={form.beschreibung_en}
          onChange={(e) => setForm((f) => ({ ...f, beschreibung_en: e.target.value }))}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="thema-sort">Reihenfolge</Label>
        <Input
          id="thema-sort"
          type="number"
          value={form.sort_order}
          onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
          className="w-32"
        />
      </div>
      <div className="flex items-center gap-2">
        <Switch
          id="thema-aktiv"
          checked={form.aktiv}
          onCheckedChange={(v) => setForm((f) => ({ ...f, aktiv: v }))}
        />
        <Label htmlFor="thema-aktiv" className="cursor-pointer font-normal">
          Aktiv (im öffentlichen Formular sichtbar)
        </Label>
      </div>
    </>
  )
}

const config: StammdatenConfig<Thema, Form> = {
  collection: 'themen',
  queryKey: adminKeys.stammdaten('themen'),
  sort: 'sort_order,name',
  texte: {
    beschreibung: 'Konfigurierbare Themen für Führungen und Seminare.',
    neuButton: 'Neues Thema',
    dialogNeu: 'Neues Thema',
    dialogBearbeiten: 'Thema bearbeiten',
    leer: 'Noch keine Themen angelegt.',
    erstellt: 'Thema angelegt.',
    aktualisiert: 'Thema aktualisiert.',
    geloescht: 'Thema gelöscht.',
  },
  spalten: [
    { header: 'Name', className: 'font-medium', render: (t) => t.name },
    {
      header: 'Beschreibung',
      className: 'max-w-xs truncate text-muted-foreground',
      render: (t) => t.beschreibung || '–',
    },
    { header: 'Reihenfolge', render: (t) => t.sort_order ?? 0 },
  ],
  emptyForm: () => ({
    name: '',
    name_en: '',
    beschreibung: '',
    beschreibung_en: '',
    sort_order: '0',
    aktiv: true,
  }),
  toForm: (t) => ({
    name: t.name,
    name_en: t.name_en ?? '',
    beschreibung: t.beschreibung ?? '',
    beschreibung_en: t.beschreibung_en ?? '',
    sort_order: String(t.sort_order ?? 0),
    aktiv: t.aktiv,
  }),
  validate: (form) => (form.name.trim() ? null : 'Bitte einen Namen angeben.'),
  toBody: (form) => ({
    name: form.name.trim(),
    name_en: form.name_en.trim(),
    beschreibung: form.beschreibung.trim() || undefined,
    beschreibung_en: form.beschreibung_en.trim(),
    sort_order: Number(form.sort_order) || 0,
    aktiv: form.aktiv,
  }),
  FormFields,
  aktivToggle: true,
  deleteTitle: (t) => `„${t.name}" löschen?`,
  deleteDescription: () =>
    'Falls das Thema noch in Buchungen oder bei Referent:innen verwendet wird, schlägt das Löschen fehl — dann bitte stattdessen deaktivieren.',
  deleteFehlerRessource: 'Thema',
}

export function ThemenTab() {
  return <StammdatenCrud config={config} />
}
