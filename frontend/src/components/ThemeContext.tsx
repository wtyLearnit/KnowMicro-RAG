/* Theme Context - 深邃蓝 / 晨光白 / 古宣纸 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'cosmos' | 'light' | 'xuan' | 'forest' | 'rose'

interface ThemeContextValue {
  theme: Theme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'cosmos',
  setTheme: () => {},
  toggleTheme: () => {},
})

const VALID_THEMES: Theme[] = ['cosmos', 'light', 'xuan', 'forest', 'rose']

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme') as Theme | null
    return saved && VALID_THEMES.includes(saved) ? saved : 'cosmos'
  })

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('theme', t)
  }

  const toggleTheme = () => {
    const order: Theme[] = ['cosmos', 'light', 'xuan', 'forest', 'rose']
    const next = order[(order.indexOf(theme) + 1) % order.length]
    setTheme(next)
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
  }, [theme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
