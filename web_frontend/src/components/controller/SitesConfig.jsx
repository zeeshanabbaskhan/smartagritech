import { useState } from 'react'
import { Building2, Plus, Edit2, Trash2, CheckCircle2, AlertTriangle } from 'lucide-react'
import Modal from '../ui/Modal'
import { TextInput } from '../ui/FormFields'

export default function SitesConfig({
  sites = [],
  sources = [],
  onChange,
  readOnly = false,
}) {
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSite, setEditingSite] = useState(null)
  const [siteName, setSiteName] = useState('')
  const [deleteCandidate, setDeleteCandidate] = useState(null)

  const openAdd = () => {
    setEditingSite(null)
    setSiteName('')
    setModalOpen(true)
  }

  const openEdit = (site) => {
    setEditingSite(site)
    setSiteName(site.name || '')
    setModalOpen(true)
  }

  const handleSaveModal = () => {
    const trimmed = siteName.trim()
    if (!trimmed || readOnly) return

    if (editingSite) {
      // Rename
      const nextSites = sites.map((s) => (s.id === editingSite.id ? { ...s, name: trimmed } : s))
      onChange?.(nextSites, sources)
    } else {
      // Add
      const nextSites = [
        ...sites,
        {
          id: `site-${Date.now()}`,
          name: trimmed,
          isDefault: sites.length === 0,
        },
      ]
      onChange?.(nextSites, sources)
    }

    setModalOpen(false)
  }

  const handleSetDefault = (siteId) => {
    if (readOnly) return
    const nextSites = sites.map((s) => ({
      ...s,
      isDefault: s.id === siteId,
    }))
    onChange?.(nextSites, sources)
  }

  const handleDelete = (siteId) => {
    if (readOnly || sites.length <= 1) return

    const remainingSites = sites.filter((s) => s.id !== siteId)
    // If the deleted site was default, make the first remaining site default
    const hasDefault = remainingSites.some((s) => s.isDefault)
    if (!hasDefault && remainingSites.length > 0) {
      remainingSites[0].isDefault = true
    }

    const fallbackSiteId = remainingSites[0]?.id || 'site-1'

    // Reassign sources pointing to the deleted site to fallback site
    const nextSources = sources.map((src) => {
      if (src.siteId === siteId) {
        return { ...src, siteId: fallbackSiteId }
      }
      return src
    })

    onChange?.(remainingSites, nextSources)
    setDeleteCandidate(null)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-bold text-surface-900 dark:text-surface-100">
            Factory & Facility Sites
          </h3>
          <p className="text-xs text-surface-500 dark:text-surface-400">
            Organize energy generation and distribution by physical campuses, buildings, or production plants.
          </p>
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={openAdd}
            className="btn-primary py-2 px-3 text-xs flex items-center gap-1.5 self-start sm:self-auto font-bold"
          >
            <Plus size={14} /> Add Site
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {sites.map((site) => {
          const attachedSources = sources.filter((s) => s.siteId === site.id)
          const isDefault = !!site.isDefault

          return (
            <div
              key={site.id}
              className={`p-4 rounded-xl border bg-white dark:bg-surface-900 shadow-xs flex flex-col justify-between ${
                isDefault ? 'border-primary-400 dark:border-primary-700 ring-1 ring-primary-400/20' : 'border-surface-200 dark:border-surface-800'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-primary-950/40 text-primary-600 flex items-center justify-center flex-shrink-0">
                      <Building2 size={16} />
                    </div>
                    <span className="text-sm font-bold text-surface-900 dark:text-surface-100 truncate">
                      {site.name}
                    </span>
                  </div>

                  {isDefault && (
                    <span className="badge badge-primary text-[10px] py-0.5 px-2 flex items-center gap-1 font-bold">
                      <CheckCircle2 size={11} /> Default
                    </span>
                  )}
                </div>

                <div className="text-xs text-surface-500 dark:text-surface-400 space-y-1 mt-3">
                  <p className="flex items-center justify-between">
                    <span>Assigned Sources:</span>
                    <span className="font-bold text-surface-800 dark:text-surface-200">
                      {attachedSources.length} source{attachedSources.length !== 1 ? 's' : ''}
                    </span>
                  </p>
                  <p className="flex items-center justify-between">
                    <span>Internal ID:</span>
                    <span className="font-mono text-[10px] text-surface-400">{site.id}</span>
                  </p>
                </div>
              </div>

              {!readOnly && (
                <div className="pt-4 mt-4 border-t border-surface-100 dark:border-surface-800 flex items-center justify-between gap-2">
                  {!isDefault ? (
                    <button
                      type="button"
                      onClick={() => handleSetDefault(site.id)}
                      className="text-[11px] font-semibold text-primary-600 hover:text-primary-700"
                    >
                      Set as Default
                    </button>
                  ) : (
                    <span className="text-[11px] text-surface-400 italic">Primary Location</span>
                  )}

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(site)}
                      className="p-1.5 rounded-lg text-surface-400 hover:text-primary-600 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                      title="Rename Site"
                    >
                      <Edit2 size={13} />
                    </button>
                    {sites.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setDeleteCandidate(site)}
                        className="p-1.5 rounded-lg text-surface-400 hover:text-danger-600 hover:bg-surface-50 dark:hover:bg-surface-800 transition-colors"
                        title="Delete Site"
                      >
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add / Edit Site Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        size="sm"
        title={editingSite ? 'Rename Site' : 'Add New Site'}
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-primary"
              disabled={!siteName.trim()}
              onClick={handleSaveModal}
            >
              {editingSite ? 'Save Name' : 'Create Site'}
            </button>
          </>
        }
      >
        <TextInput
          label="Site Name"
          required
          autoFocus
          placeholder="e.g. Main Plant, Warehouse B, Unit 3…"
          value={siteName}
          onChange={(e) => setSiteName(e.target.value)}
        />
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        open={deleteCandidate !== null}
        onClose={() => setDeleteCandidate(null)}
        size="sm"
        title="Delete Site"
        footer={
          <>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => setDeleteCandidate(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={() => deleteCandidate && handleDelete(deleteCandidate.id)}
            >
              Delete Site
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-xs text-surface-600 dark:text-surface-300">
            Are you sure you want to delete site <strong>{deleteCandidate?.name}</strong>?
          </p>
          {sources.filter((s) => s.siteId === deleteCandidate?.id).length > 0 && (
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/80 text-amber-900 dark:text-amber-300 text-xs flex items-start gap-2">
              <AlertTriangle size={15} className="flex-shrink-0 mt-0.5 text-amber-600" />
              <span>
                Energy sources currently assigned to this site will be automatically reassigned to the default primary site.
              </span>
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
