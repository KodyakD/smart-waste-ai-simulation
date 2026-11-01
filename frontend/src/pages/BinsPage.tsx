import { useState, type FormEvent } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import { api } from '../api'
import type { Bin } from '../types'

type Props = { bins: Bin[]; onRefresh: () => Promise<void>; loading: boolean; backendOnline: boolean }

const emptyDraft = { id: '', name: '', location: '', capacity_cm: '', fill_percentage: '0' }

export default function BinsPage({ bins, onRefresh, loading, backendOnline }: Props) {
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState(emptyDraft)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState({ name: '', location: '', capacity_cm: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const createBin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await api.createBin({
        id: draft.id.trim(),
        name: draft.name.trim(),
        location: draft.location.trim(),
        capacity_cm: Number(draft.capacity_cm),
        fill_percentage: Number(draft.fill_percentage),
      })
      await onRefresh()
      setDraft(emptyDraft)
      setAdding(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to create bin')
    } finally {
      setBusy(false)
    }
  }

  const beginEdit = (bin: Bin) => {
    setEditingId(bin.id)
    setEditDraft({ name: bin.name, location: bin.location, capacity_cm: String(bin.capacity_cm) })
    setError('')
  }

  const saveEdit = async (id: string) => {
    setBusy(true)
    setError('')
    try {
      await api.updateBin(id, {
        name: editDraft.name.trim(),
        location: editDraft.location.trim(),
        capacity_cm: Number(editDraft.capacity_cm),
      })
      await onRefresh()
      setEditingId(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to update bin')
    } finally {
      setBusy(false)
    }
  }

  const deleteBin = async (bin: Bin) => {
    const confirmed = window.confirm(`Delete ${bin.name} (${bin.id})? Its readings will be removed; alert history will remain.`)
    if (!confirmed) return
    setBusy(true)
    setError('')
    try {
      await api.deleteBin(bin.id)
      await onRefresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Unable to delete bin')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-intro">
        <div><div className="eyebrow">NETWORK MANAGEMENT</div><h1>Virtual bins</h1><p>Create, edit and remove simulated containers. Changes are saved by the backend.</p></div>
        <div className="intro-action"><button className="button button-primary" onClick={() => { setAdding(true); setError('') }}><Plus size={16} /> Add bin</button></div>
      </div>
      {error && <div className="error-box">{error}</div>}
      {adding && (
        <form className="panel bin-form-panel" onSubmit={createBin}>
          <div className="panel-heading"><div><div className="panel-kicker">NEW VIRTUAL BIN</div><h2>Bin details</h2></div><button type="button" className="icon-button" aria-label="Close form" onClick={() => setAdding(false)}><X size={17} /></button></div>
          <div className="bin-form-grid">
            <label>Bin ID<input required pattern="[A-Z0-9-]{3,16}" maxLength={16} value={draft.id} onChange={event => setDraft({ ...draft, id: event.target.value.toUpperCase() })} placeholder="BIN-004" /></label>
            <label>Name<input required maxLength={60} value={draft.name} onChange={event => setDraft({ ...draft, name: event.target.value })} placeholder="North entrance" /></label>
            <label>Location<input required maxLength={60} value={draft.location} onChange={event => setDraft({ ...draft, location: event.target.value })} placeholder="Zone D" /></label>
            <label>Empty distance (cm)<input required type="number" min="20" max="400" step="0.1" value={draft.capacity_cm} onChange={event => setDraft({ ...draft, capacity_cm: event.target.value })} placeholder="Enter empty distance" /></label>
            <label>Initial fill (%)<input required type="number" min="0" max="100" step="0.1" value={draft.fill_percentage} onChange={event => setDraft({ ...draft, fill_percentage: event.target.value })} /></label>
          </div>
          <div className="form-actions"><button className="button button-primary" type="submit" disabled={busy}><Check size={15} /> Create bin</button><button className="button button-ghost" type="button" onClick={() => setAdding(false)}>Cancel</button></div>
        </form>
      )}
      <section className="panel bins-management-panel">
        <div className="panel-heading"><div><div className="panel-kicker">REGISTERED CONTAINERS</div><h2>Bins</h2></div><span className="tiny-chip">{bins.length} records</span></div>
        {loading && bins.length === 0 ? <div className="panel-loading">Loading virtual bins…</div> : !backendOnline && bins.length === 0 ? <div className="empty-state"><strong>Backend offline</strong><p>Connect the backend to load and manage virtual bins.</p></div> : bins.length === 0 ? <div className="empty-state"><div className="empty-icon"><Trash2 size={22} /></div><strong>No virtual bins</strong><p>Add your first bin to make it available in the simulator.</p><button className="button button-primary" onClick={() => setAdding(true)}><Plus size={15} /> Add bin</button></div> :
          <div className="telemetry-table-wrap"><table className="data-table bins-management-table"><thead><tr><th>ID</th><th>Name</th><th>Location</th><th>Empty distance</th><th>Fill</th><th>Status</th><th>Actions</th></tr></thead><tbody>
            {bins.map(bin => <tr key={bin.id}>
              <td><strong>{bin.id}</strong></td>
              {editingId === bin.id ? <>
                <td><input aria-label={`Name for ${bin.id}`} value={editDraft.name} onChange={event => setEditDraft({ ...editDraft, name: event.target.value })} /></td>
                <td><input aria-label={`Location for ${bin.id}`} value={editDraft.location} onChange={event => setEditDraft({ ...editDraft, location: event.target.value })} /></td>
                <td><input aria-label={`Capacity for ${bin.id}`} type="number" min="20" max="400" step="0.1" value={editDraft.capacity_cm} onChange={event => setEditDraft({ ...editDraft, capacity_cm: event.target.value })} /> cm</td>
                <td>{bin.fill_percentage.toFixed(1)}%</td><td><span className={`status-tag ${bin.status}`}>{bin.status.replace('_', ' ')}</span></td>
                <td><div className="table-actions"><button className="icon-button" aria-label={`Save ${bin.id}`} disabled={busy} onClick={() => void saveEdit(bin.id)}><Check size={15} /></button><button className="icon-button" aria-label={`Cancel edit ${bin.id}`} onClick={() => setEditingId(null)}><X size={15} /></button></div></td>
              </> : <>
                <td>{bin.name}</td><td>{bin.location}</td><td>{bin.capacity_cm.toFixed(1)} cm</td><td><strong>{bin.fill_percentage.toFixed(1)}%</strong></td><td><span className={`status-tag ${bin.status}`}>{bin.status.replace('_', ' ')}</span></td>
                <td><div className="table-actions"><button className="icon-button" aria-label={`Edit ${bin.id}`} disabled={busy} onClick={() => beginEdit(bin)}><Pencil size={15} /></button><button className="icon-button" aria-label={`Delete ${bin.id}`} disabled={busy} onClick={() => void deleteBin(bin)}><Trash2 size={15} /></button></div></td>
              </>}
            </tr>)}
          </tbody></table></div>}
      </section>
    </>
  )
}
