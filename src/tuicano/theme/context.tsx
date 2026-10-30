// The theme, handed down the tree (spec §2.7). Screens read it with useTheme()
// instead of naming a colour, so switching a theme repaints everything and no
// screen has an opinion about looks.
import { createContext, useContext, type ReactNode } from 'react'
import type { AgentColor } from '../../shared/types'
import { findTheme, type Theme } from './index'

const ThemeContext = createContext<Theme>(findTheme(undefined))

export function ThemeProvider({ theme, children }: { theme: Theme; children: ReactNode }): ReactNode {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export const useTheme = (): Theme => useContext(ThemeContext)

/** An agent's stored colour, in the current theme. */
export const agentColor = (theme: Theme, color: AgentColor | undefined): string => (color ? theme.agent[color] : theme.dim)

export type { Theme }
