import { useState, useEffect } from 'react'
import emsApi, { list } from '../api/emsApi'
import { LIST_TYPE_NAMES } from '../data/managedLists'

/**
 * Load active item names for a managed list type (e.g. Protocols and Drivers).
 * Falls back to `fallback` if the API is empty or fails.
 */
export function useManagedListOptions(listTypeName, fallback = []) {
  const [options, setOptions] = useState(fallback)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const types = list(await emsApi.getListTypes({ limit: 100 }))
        let type = types.find((t) => t.name === listTypeName)
        if (!type) {
          try {
            const created = await emsApi.createListType({
              name: listTypeName,
              description:
                listTypeName === LIST_TYPE_NAMES.PROTOCOLS
                  ? 'IoT communication protocols and drivers'
                  : listTypeName === LIST_TYPE_NAMES.ACQUISITION
                    ? 'Device template acquisition methods'
                    : 'Managed list',
            })
            type = created?.data ?? created
          } catch (_) { /* ignore race */ }
          const refreshed = list(await emsApi.getListTypes({ limit: 100 }))
          type = refreshed.find((t) => t.name === listTypeName) || type
        }
        if (!type?.id) {
          if (!cancelled) setOptions(fallback)
          return
        }
        const items = list(await emsApi.getListItems(type.id, { limit: 200, isActive: 'true' }))
        const names = items.map((i) => i.name).filter(Boolean)
        if (!cancelled) setOptions(names.length ? names : fallback)
      } catch (_) {
        if (!cancelled) setOptions(fallback)
      }
    })()
    return () => { cancelled = true }
  }, [listTypeName]) // eslint-disable-line react-hooks/exhaustive-deps

  return options
}
