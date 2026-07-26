import { createContext, useContext, useState } from 'react'
import { accessGroups as initialGroups } from '../data/dummy'

const AccessGroupContext = createContext(null)

export function AccessGroupProvider({ children }) {
  const [groups, setGroups] = useState(() => {
    try {
      const saved = localStorage.getItem('cf-ems-access-groups')
      return saved ? JSON.parse(saved) : initialGroups
    } catch {
      return initialGroups
    }
  })

  function persist(next) {
    setGroups(next)
    localStorage.setItem('cf-ems-access-groups', JSON.stringify(next))
  }

  function createGroup({ name, org, deviceIds, userIds, createdBy = 'admin' }) {
    const g = {
      id: Date.now(),
      name,
      org,
      deviceIds: deviceIds ?? [],
      userIds: userIds ?? [],
      createdBy,
      createdAt: new Date().toISOString().slice(0, 10),
    }
    persist([...groups, g])
    return g
  }

  function updateGroup(id, patch) {
    persist(groups.map(g => (g.id === id ? { ...g, ...patch } : g)))
  }

  function deleteGroup(id) {
    persist(groups.filter(g => g.id !== id))
  }

  function getGroupsForOrg(orgName) {
    return groups.filter(g => g.org === orgName)
  }

  return (
    <AccessGroupContext.Provider value={{ groups, createGroup, updateGroup, deleteGroup, getGroupsForOrg }}>
      {children}
    </AccessGroupContext.Provider>
  )
}

export const useAccessGroups = () => useContext(AccessGroupContext)
