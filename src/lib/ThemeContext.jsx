import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { DEFAULT_THEME } from '../data/themes'

const ThemeContext = createContext(null)

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(DEFAULT_THEME)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error } = await supabase.from('settings').select('theme').eq('id', 1).maybeSingle()
      if (active) {
        if (!error && data?.theme) setThemeState(data.theme)
        setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  async function setTheme(id) {
    setThemeState(id) // optimistic — apply instantly
    await supabase.from('settings').upsert({ id: 1, theme: id, updated_at: new Date().toISOString() })
  }

  return <ThemeContext.Provider value={{ theme, setTheme, loading }}>{children}</ThemeContext.Provider>
}

export const useTheme = () => useContext(ThemeContext)
