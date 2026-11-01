import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import type { ReactNode } from 'react'
import { api } from './api'
import type { AppConfig } from './types'

type ConfigValue = {
  config: AppConfig | null
  loading: boolean
  error: string | null
}

const ConfigContext = createContext<ConfigValue | null>(null)

export function ConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadConfig = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setConfig(await api.config())
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to load application configuration')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { void loadConfig() }, [loadConfig])

  return <ConfigContext.Provider value={{ config, loading, error }}>{children}</ConfigContext.Provider>
}

export function useConfig() {
  const value = useContext(ConfigContext)
  if (!value) throw new Error('useConfig must be used within ConfigProvider')
  return value
}
