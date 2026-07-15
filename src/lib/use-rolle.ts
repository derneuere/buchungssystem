// Einzige Ableitungsstelle der wirksamen Rolle aus dem PocketBase-authStore.
// `pb.authStore` ist nicht reaktiv; nach einem QA-Rollen-Wechsel (authRefresh)
// oder Login abonniert `useRolle` `pb.authStore.onChange`, damit die Navigation
// und rollenabhängige UI sofort neu rendern.

import { useEffect, useState } from 'react'

import { pb } from './pocketbase'
import type { Mitarbeiter, Rolle } from './types'

export function aktuelleRolle(): Rolle | null {
  const rec = pb.authStore.record as Mitarbeiter | null
  return rec?.rolle ?? null
}

export function useRolle(): Rolle | null {
  const [rolle, setRolle] = useState<Rolle | null>(aktuelleRolle())
  useEffect(() => {
    // onChange feuert bei Login/Logout und authRefresh() (QA-Rollen-Wechsel).
    return pb.authStore.onChange(() => setRolle(aktuelleRolle()))
  }, [])
  return rolle
}

export const istLeitung = (r: Rolle | null) => r === 'leitung'
export const istPersonal = (r: Rolle | null) => r === 'leitung' || r === 'mitarbeiter'
export const istAuskunft = (r: Rolle | null) => r === 'auskunft'
