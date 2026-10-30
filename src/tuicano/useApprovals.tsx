// Deciding an approval, wired to the gate (spec §3.1 #28): the rule lives in
// approvals.ts, this is the two things a keypress needs — the armed state for a
// high-risk call and the reason prompt for a refusal — shared by the Approvals
// screen and the card inside a conversation, so both behave identically.
import { useState } from 'react'
import type { Approval } from '../shared/types'
import { L } from '../shared/lang'
import { store } from './store'
import { useOverlay } from './overlays/api'
import { gateIntent, type GateKey } from './approvals'

export function useApprovalGate(): { armed: string | undefined; press: (approval: Approval, key: GateKey) => void } {
  const overlay = useOverlay()
  const [armed, setArmed] = useState<{ id: string; at: number } | null>(null)

  const press = (a: Approval, key: GateKey): void => {
    const intent = gateIntent(key, a, armed?.id === a.id ? armed.at : undefined, Date.now())
    if (intent.kind === 'arm') {
      setArmed({ id: a.id, at: Date.now() })
      overlay.note('high risk: press the same key again within 3 s to confirm')
      return
    }
    setArmed(null)
    if (intent.kind === 'ask-reason') {
      overlay.prompt({
        title: L(`Recusar ${a.tool}?`, `Refuse ${a.tool}?`),
        label: L('Motivo (opcional)', 'Reason (optional)'),
        hint: L('O agente é avisado por quê, e pode propor outro caminho.', 'The agent is told why, and can propose another way.'),
        onSubmit: (text) => {
          store.decideApproval(a.id, 'refused', text.trim() || undefined)
          overlay.note(L(`recusado: ${a.tool}`, `refused: ${a.tool}`))
        },
        onCancel: () => overlay.note(undefined)
      })
      return
    }
    store.decideApproval(a.id, 'approved', undefined, intent.always)
    overlay.note(L(`${intent.always ? 'sempre permitido' : 'aprovado'}: ${a.tool}`, `${intent.always ? 'always allowed' : 'approved'}: ${a.tool}`))
  }

  return { armed: armed?.id, press }
}
