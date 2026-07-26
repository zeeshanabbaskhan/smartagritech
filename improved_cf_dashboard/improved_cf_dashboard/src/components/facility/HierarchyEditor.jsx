import { useEffect, useState } from 'react'
import { Network, Building, Layers, Folder, Cpu, Activity, HelpCircle, Info } from 'lucide-react'

const HIERARCHY_FIELDS = [
  { type: 'Campus',     label: 'Campus Name(s)',     placeholder: 'e.g. North Campus, South Campus',     icon: <Network size={14} className="text-primary-500" /> },
  { type: 'Site',       label: 'Site Name(s)',       placeholder: 'e.g. Site Alpha, Site Beta',         icon: <Building size={14} className="text-info-600" /> },
  { type: 'Building',   label: 'Building Name(s)',   placeholder: 'e.g. Building A, Building B',         icon: <Building size={14} className="text-info-500" /> },
  { type: 'Block',      label: 'Block Name(s)',      placeholder: 'e.g. Block 1, Block 2',               icon: <Layers size={14} className="text-warning-600" /> },
  { type: 'Wing',       label: 'Wing Name(s)',       placeholder: 'e.g. Left Wing, Right Wing',          icon: <Layers size={14} className="text-warning-500" /> },
  { type: 'Floor',      label: 'Floor Name(s)',      placeholder: 'e.g. Ground Floor, 1st Floor, 2nd Floor', icon: <Layers size={14} className="text-info-400" /> },
  { type: 'Zone',       label: 'Zone Name(s)',       placeholder: 'e.g. Cooling Zone, Heating Zone',     icon: <Layers size={14} className="text-warning-400" /> },
  { type: 'Room',       label: 'Room Name(s)',       placeholder: 'e.g. Server Room, Control Room',      icon: <Folder size={14} className="text-success-400" /> },
  { type: 'Department', label: 'Department Name(s)', placeholder: 'e.g. Admin, Production, IT Dept',      icon: <Folder size={14} className="text-success-600" /> },
  { type: 'Section',    label: 'Section Name(s)',    placeholder: 'e.g. Assembly Line, Packaging Section',icon: <Folder size={14} className="text-success-500" /> },
  { type: 'Asset',      label: 'Asset Name(s)',      placeholder: 'e.g. Boiler Asset, HVAC Asset',       icon: <Cpu size={14} className="text-purple-500" /> },
  { type: 'Device',     label: 'Device Name(s)',     placeholder: 'e.g. Meter A, Generator B',           icon: <Cpu size={14} className="text-purple-600" /> },
  { type: 'Sensor',     label: 'Sensor Name(s)',     placeholder: 'e.g. Temp Sensor, Power Sensor',      icon: <Activity size={14} className="text-rose-600" /> },
]

function extractNamesFromTree(nodes, type) {
  let names = []
  if (!nodes) return names
  for (const n of nodes) {
    if (n.type === type) {
      names.push(n.name)
    }
    if (n.children && n.children.length > 0) {
      names = names.concat(extractNamesFromTree(n.children, type))
    }
  }
  return Array.from(new Set(names))
}

function buildTreeFromFormFields(fields, orgName) {
  const order = [
    'Organization', 'Campus', 'Site', 'Building', 'Block', 'Wing',
    'Floor', 'Zone', 'Room', 'Department', 'Section', 'Asset', 'Device', 'Sensor'
  ]
  
  let root = { id: 'root-org', name: orgName || 'My Organization', type: 'Organization', children: [] }
  let currentLevelNodes = [root]

  for (let i = 1; i < order.length; i++) {
    const type = order[i]
    const val = fields[type] || ''
    if (!val.trim()) continue

    const names = val.split(',').map(s => s.trim()).filter(Boolean)
    if (names.length === 0) continue

    const nextLevelNodes = []
    for (const parent of currentLevelNodes) {
      parent.children = parent.children || []
      for (const name of names) {
        const child = { id: `node-${type}-${Math.random().toString(36).slice(2, 7)}`, name, type, children: [] }
        parent.children.push(child)
        nextLevelNodes.push(child)
      }
    }
    currentLevelNodes = nextLevelNodes
  }

  return [root]
}

export default function HierarchyEditor({ buildings, onChange, orgName }) {
  const tree = buildings || []
  const [fields, setFields] = useState({
    Campus: '', Site: '', Building: '', Block: '', Wing: '',
    Floor: '', Zone: '', Room: '', Department: '', Section: '', Asset: '', Device: '', Sensor: ''
  })

  // Initialize fields when tree loads/changes (to support edits)
  useEffect(() => {
    if (tree.length > 0) {
      const nextFields = {}
      const ALL_TYPES = [
        'Campus', 'Site', 'Building', 'Block', 'Wing',
        'Floor', 'Zone', 'Room', 'Department', 'Section', 'Asset', 'Device', 'Sensor'
      ]
      let hasData = false
      ALL_TYPES.forEach(t => {
        const names = extractNamesFromTree(tree, t)
        if (names.length > 0) hasData = true
        nextFields[t] = names.join(', ')
      })
      if (hasData) {
        setFields(nextFields)
      }
    }
  }, [tree])

  // Automatically update root node when orgName changes
  useEffect(() => {
    const activeName = orgName ? orgName.trim() : ''
    if (tree.length === 0 && activeName) {
      onChange([{ id: 'root-org', name: activeName, type: 'Organization', children: [] }])
    } else if (tree.length > 0) {
      const root = tree[0]
      if (root.type === 'Organization' && root.name !== activeName) {
        onChange(tree.map((node, i) => i === 0 ? { ...node, name: activeName } : node))
      }
    }
  }, [orgName, tree, onChange])

  const handleFieldChange = (type, val) => {
    const nextFields = { ...fields, [type]: val }
    setFields(nextFields)
    const nextTree = buildTreeFromFormFields(nextFields, orgName)
    onChange(nextTree)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 p-3 bg-primary-50 dark:bg-primary-950/20 text-primary-700 dark:text-primary-300 rounded-xl text-xs leading-relaxed border border-primary-100 dark:border-primary-950/40">
        <Info size={16} className="mt-0.5 flex-shrink-0" />
        <div>
          <span className="font-bold">Hierarchy Quick Builder: </span>
          Fill in any of the levels below to define your facility structure. To add multiple items at the same level (e.g. multiple buildings or departments), separate their names with commas. Leave any unused levels blank.
        </div>
      </div>

      <div className="border border-surface-200 dark:border-surface-800 p-4 rounded-xl space-y-4 max-h-[50vh] overflow-y-auto bg-white dark:bg-surface-900">
        {/* Read-only Organization level */}
        <div className="flex flex-col gap-1">
          <label className="text-[10px] uppercase font-black tracking-wider text-surface-400 flex items-center gap-1.5">
            <Network size={12} className="text-primary-600" />
            <span>Organization Name (Pre-filled)</span>
          </label>
          <input
            className="input text-xs py-1.5 px-3 bg-surface-100 dark:bg-surface-800 text-surface-500 font-semibold cursor-not-allowed select-none border-surface-200 dark:border-surface-700"
            value={orgName || 'Enter Organization Name above'}
            disabled
            readOnly
          />
        </div>

        {/* Dynamic inputs for all 13 hierarchy levels */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {HIERARCHY_FIELDS.map(f => (
            <div key={f.type} className="flex flex-col gap-1">
              <label className="text-[10px] uppercase font-black tracking-wider text-surface-700 dark:text-surface-300 flex items-center gap-1.5">
                {f.icon}
                <span>{f.label}</span>
              </label>
              <input
                className="input text-xs py-1.5 px-3 bg-white dark:bg-surface-800 border-surface-200 dark:border-surface-700 text-surface-800 dark:text-surface-100 focus:ring-1 focus:ring-primary-500 rounded-lg"
                placeholder={f.placeholder}
                value={fields[f.type] || ''}
                onChange={e => handleFieldChange(f.type, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
