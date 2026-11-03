// The keymap, in one table (spec §3.4): the `?` help reads from here, so a key
// that exists but is not documented — or the other way around — cannot happen.
export interface KeyHelp {
  keys: string
  what: string
}

export const GLOBAL_KEYS: KeyHelp[] = [
  { keys: 'Tab', what: 'move between the sidebar and the screen (Shift+Tab goes back)' },
  { keys: '⌫ Backspace', what: 'back to the screen you came from' },
  { keys: '1-9', what: 'go to channel 1 to 9 (as Cmd-1-9 in the app)' },
  { keys: 'a', what: 'approvals' },
  { keys: 'i', what: 'write a message (from either pane, in a conversation)' },
  { keys: 'n', what: 'new channel (as Cmd-N)' },
  { keys: '/', what: 'search (as Cmd-K)' },
  { keys: ',', what: 'settings (as Cmd-,)' },
  { keys: 'u c m r k b', what: 'usage, connectors, memory, routines, skills, report' },
  { keys: 'g · t', what: 'a new agent · the Tuca' },
  { keys: 'Ctrl+T', what: 'themes' },
  { keys: '?', what: 'this help' },
  { keys: 'q · Ctrl+C', what: 'quit' }
]

export const CONVERSATION_KEYS: KeyHelp[] = [
  { keys: 'Enter', what: 'send (while writing)' },
  { keys: 'Esc', what: 'leave the composer' },
  { keys: 's', what: 'stop the reply in progress' },
  { keys: 'r', what: 'retry the reply' },
  { keys: 'C', what: 'continue a reply paused at the budget' },
  { keys: 'v', what: 'open the message image (graphics protocol)' },
  { keys: 'o', what: 'open a link or artifact in the system' },
  { keys: 't', what: 'the reply receipt' },
  { keys: 'S', what: 'the conversation summary' }
]

export const APPROVAL_KEYS: KeyHelp[] = [
  { keys: 'y', what: 'approve (high risk: twice within 3 s)' },
  { keys: 'x', what: 'refuse, with an optional reason' },
  { keys: 'Y', what: 'approve and stop asking about that tool' }
]

export const PICKER_KEYS: KeyHelp[] = [
  { keys: '↑ ↓', what: 'move' },
  { keys: 'Enter', what: 'open the selected thing' },
  { keys: 'm · t · R · d', what: 'members, topic, rename, delete a channel' }
]

// Whatever the parity matrix has not reached yet (spec §5), listed so the help
// never promises a key that does nothing.
export const LATER_KEYS: KeyHelp[] = []
