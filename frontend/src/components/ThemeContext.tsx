/* Theme Context - 深邃蓝 / 晨光白 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Theme = 'cosmos' | 'light'

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

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => {
    const saved = localStorage.getItem('theme')
    return (saved === 'cosmos' || saved === 'light') ? saved : 'cosmos'
  })

  const setTheme = (t: Theme) => {
    setThemeState(t)
    localStorage.setItem('theme', t)
  }

  const toggleTheme = () => {
    setTheme(theme === 'cosmos' ? 'light' : 'cosmos')
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
