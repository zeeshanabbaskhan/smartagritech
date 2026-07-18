import { createContext, useContext, useState } from 'react'

const DeviceGroupContext = createContext(null)

const STORAGE_KEY = 'cf-ems-device-groups'

export function DeviceGroupProvider({ children }) {
  const [deviceGroups, setDeviceGroups] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  function persist(next) {
    setDeviceGroups(next)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  }

  // name is fully free-form/editable — e.g. "Washing Area", "Boilers", "G1", "G2"...
  function createDeviceGroup({ name, org, description = '', deviceIds = [], userIds = [], createdBy = 'org' }) {
    const g = {
      id: Date.now(),
      name,
      org,
      description,
      deviceIds,
      userIds,
      createdBy,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    persist([...deviceGroups, g])
    return g
  }

  function updateDeviceGroup(id, patch) {
    persist(deviceGroups.map(g => (g.id === id ? { ...g, ...patch } : g)))
  }

  function deleteDeviceGroup(id) {
    persist(deviceGroups.filter(g => g.id !== id))
  }

  function getDeviceGroupsForOrg(orgName) {
    return deviceGroups.filter(g => g.org === orgName)
  }

  return (
    <DeviceGroupContext.Provider
      value={{
        deviceGroups,
        createDeviceGroup,
        updateDeviceGroup,
        deleteDeviceGroup,
        getDeviceGroupsForOrg,
      }}
    >
      {children}
    </DeviceGroupContext.Provider>
  )
}

export const useDeviceGroups = () => useContext(DeviceGroupContext)
