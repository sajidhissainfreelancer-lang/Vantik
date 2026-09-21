import { useEffect, useState } from 'react'
import { supabase } from './supabaseClient'
import { SITE } from '../data/site'

/**
 * Pulls the live "clients / projects" counters and the portfolio list from
 * Supabase. If the tables don't exist yet (fresh clone, before running
 * supabase/schema.sql) it quietly falls back to sensible defaults instead
 * of crashing the page.
 */
export function useSiteStats() {
  const [stats, setStats] = useState(SITE.fallbackStats)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error } = await supabase
        .from('settings')
        .select('clients_count, projects_count')
        .eq('id', 1)
        .maybeSingle()

      if (active) {
        if (!error && data) {
          setStats({
            clients_count: data.clients_count ?? SITE.fallbackStats.clients_count,
            projects_count: data.projects_count ?? SITE.fallbackStats.projects_count,
          })
        }
        setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return { stats, loading }
}

export function useClientProjects() {
  const [projects, setProjects] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    async function load() {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false })

      if (active) {
        if (!error && data) setProjects(data)
        setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [])

  return { projects, loading }
}
