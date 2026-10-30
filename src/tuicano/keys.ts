// The keymap, in one table (spec §3.4): the `?` help reads from here, so a key
// that exists but is not documented — or the other way around — cannot happen.
export interface KeyHelp {
  keys: string
  what: string
}

// What this phase answers. Keep it in step with the handlers in app.tsx.
export const GLOBAL_KEYS: KeyHelp[] = [
  { keys: 'up down · k j', what: 'move in the list' },
  { keys: 'Enter', what: 'open the selected thing' },
  { keys: 'Tab', what: 'swap focus between the sidebar and the pane' },
  { keys: '1-9', what: 'go to channel 1 to 9 (as Cmd-1-9 in the app)' },
  { keys: 'a', what: 'approvals' },
  { keys: '?', what: 'this help' },
  { keys: 'q · Ctrl+C', what: 'quit' }
]

export const CONVERSATION_KEYS: KeyHelp[] = [
  { keys: 'i', what: 'write a message' },
  { keys: 'Enter', what: 'send (while writing)' },
  { keys: 'Esc', what: 'leave the composer, or close what is open' },
  { keys: 's', what: 'stop the reply in progress' },
  { keys: 'r', what: 'retry the reply' },
  { keys: 'C', what: 'continue a reply paused at the budget' },
  { keys: 'v', what: 'open the message image (graphics protocol)' },
  { keys: 'o', what: 'open a link or artifact in the system' }
]

export const APPROVAL_KEYS: KeyHelp[] = [
  { keys: 'y', what: 'approve (high risk: twice within 3 s)' },
  { keys: 'x', what: 'refuse, with an optional reason' },
  { keys: 'Y', what: 'approve and stop asking about that tool' }
]

// Rows of the parity matrix this phase does not reach yet (spec §5). They are
// listed so the help never promises a key that does nothing.
export const LATER_KEYS: KeyHelp[] = [
  { keys: '/', what: 'search (P5)' },
  { keys: 'n', what: 'new channel (P5)' },
  { keys: ',', what: 'settings (P3)' },
  { keys: 'm t R d', what: 'members, topic, rename, delete a channel (P5)' },
  { keys: 't', what: 'the reply receipt (P1)' }
]
