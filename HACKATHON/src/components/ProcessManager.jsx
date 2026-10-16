/**
 * ProcessManager - Add, edit, delete processes and load example workloads.
 */
import { useState } from 'react';
import { validateProcess, validateProcessList } from '../engine/validation.js';
import { EXAMPLE_WORKLOADS } from '../engine/scheduler.js';

const PROC_COLORS = [
  '#4f8ef7','#34d399','#fbbf24','#a78bfa',
  '#f87171','#22d3ee','#fb923c','#e879f9',
];

function getColor(index) { return PROC_COLORS[index % PROC_COLORS.length]; }

function newProcess(existingCount) {
  return { id: `P${existingCount + 1}`, arrivalTime: 0, burstTime: 4, priority: 1 };
}

export default function ProcessManager({ processes, onProcessesChange, disabled }) {
  const [editId, setEditId] = useState(null);
  const [editData, setEditData] = useState({});
  const [addData, setAddData] = useState(null);
  const [errors, setErrors] = useState({});
  const [listError, setListError] = useState('');

  function startEdit(proc) {
    setEditId(proc.id);
    setEditData({ ...proc });
    setErrors({});
  }

  function cancelEdit() {
    setEditId(null);
    setEditData({});
    setErrors({});
    setAddData(null);
  }

  function saveEdit() {
    const others = processes.filter(p => p.id !== editId).map(p => p.id);
    const result = validateProcess(editData, others);
    if (!result.valid) {
      setErrors({ [editId]: result.errors });
      return;
    }
    const updated = processes.map(p => p.id === editId ? {
      id: editData.id.trim(),
      arrivalTime: Number(editData.arrivalTime),
      burstTime: Number(editData.burstTime),
      priority: Number(editData.priority),
    } : p);
    onProcessesChange(updated);
    setEditId(null);
    setErrors({});
    setListError('');
  }

  function deleteProcess(id) {
    if (processes.length === 1) { setListError('At least one process is required.'); return; }
    onProcessesChange(processes.filter(p => p.id !== id));
    setListError('');
  }

  function startAdd() {
    setAddData(newProcess(processes.length));
    setErrors({ __add: [] });
  }

  function saveAdd() {
    const ids = processes.map(p => p.id);
    const result = validateProcess(addData, ids);
    if (!result.valid) { setErrors({ __add: result.errors }); return; }
    onProcessesChange([...processes, {
      id: addData.id.trim(),
      arrivalTime: Number(addData.arrivalTime),
      burstTime: Number(addData.burstTime),
      priority: Number(addData.priority),
    }]);
    setAddData(null);
    setErrors({});
    setListError('');
  }

  function handleEditChange(field, value) {
    setEditData(d => ({ ...d, [field]: value }));
    setErrors({});
  }

  function handleAddChange(field, value) {
    setAddData(d => ({ ...d, [field]: value }));
    setErrors({});
  }

  function loadWorkload(key) {
    const wl = EXAMPLE_WORKLOADS[key];
    if (wl) { onProcessesChange(wl.processes.map(p => ({ ...p }))); setListError(''); setAddData(null); setEditId(null); }
  }

  const { valid: listValid } = validateProcessList(processes);

  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">
          <span className="panel-icon">⚙</span>
          Process Manager
        </span>
        <span className="badge badge-blue">{processes.length} proc{processes.length !== 1 ? 's' : ''}</span>
      </div>
      <div className="panel-body-sm">
        {/* Workload presets */}
        <div className="flex gap-2 flex-wrap mt-2" style={{marginBottom:'10px'}}>
          <span className="form-label" style={{alignSelf:'center'}}>Load:</span>
          {Object.entries(EXAMPLE_WORKLOADS).map(([key, wl]) => (
            <button key={key} className="btn btn-secondary btn-sm" onClick={() => loadWorkload(key)} disabled={disabled} title={wl.description}>
              {wl.name.split(' ')[0]}
            </button>
          ))}
        </div>

        {listError && <div className="alert alert-error" style={{marginBottom:'8px'}}>{listError}</div>}

        <table className="process-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Arrival</th>
              <th>Burst</th>
              <th>Priority</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {processes.map((proc, idx) => (
              editId === proc.id ? (
                <tr key={proc.id} className="inline-edit-row">
                  <td><input value={editData.id} onChange={e => handleEditChange('id', e.target.value)} style={{width:'50px'}} /></td>
                  <td><input type="number" min="0" value={editData.arrivalTime} onChange={e => handleEditChange('arrivalTime', e.target.value)} style={{width:'44px'}} /></td>
                  <td><input type="number" min="1" value={editData.burstTime} onChange={e => handleEditChange('burstTime', e.target.value)} style={{width:'44px'}} /></td>
                  <td><input type="number" min="0" value={editData.priority} onChange={e => handleEditChange('priority', e.target.value)} style={{width:'44px'}} /></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-success btn-sm" onClick={saveEdit}>✓</button>
                      <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>✕</button>
                    </div>
                  </td>
                  {errors[editId] && (
                    <tr><td colSpan="5"><div className="alert alert-error" style={{fontSize:'0.7rem', padding:'4px 8px'}}>{errors[editId].join('; ')}</div></td></tr>
                  )}
                </tr>
              ) : (
                <tr key={proc.id}>
                  <td>
                    <div className="flex items-center">
                      <span className="process-color-dot" style={{background: getColor(idx)}}></span>
                      <span style={{fontFamily:'var(--font-mono)', fontWeight:600}}>{proc.id}</span>
                    </div>
                  </td>
                  <td style={{fontFamily:'var(--font-mono)'}}>{proc.arrivalTime}</td>
                  <td style={{fontFamily:'var(--font-mono)'}}>{proc.burstTime}</td>
                  <td style={{fontFamily:'var(--font-mono)'}}>{proc.priority}</td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-ghost btn-sm btn-icon" onClick={() => startEdit(proc)} disabled={disabled} title="Edit">✎</button>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => deleteProcess(proc.id)} disabled={disabled} title="Delete">✕</button>
                    </div>
                  </td>
                </tr>
              )
            ))}
            {/* Add row */}
            {addData && (
              <>
                <tr className="inline-edit-row">
                  <td><input value={addData.id} onChange={e => handleAddChange('id', e.target.value)} style={{width:'50px'}} /></td>
                  <td><input type="number" min="0" value={addData.arrivalTime} onChange={e => handleAddChange('arrivalTime', e.target.value)} style={{width:'44px'}} /></td>
                  <td><input type="number" min="1" value={addData.burstTime} onChange={e => handleAddChange('burstTime', e.target.value)} style={{width:'44px'}} /></td>
                  <td><input type="number" min="0" value={addData.priority} onChange={e => handleAddChange('priority', e.target.value)} style={{width:'44px'}} /></td>
                  <td>
                    <div className="flex gap-2">
                      <button className="btn btn-success btn-sm" onClick={saveAdd}>✓</button>
                      <button className="btn btn-ghost btn-sm" onClick={cancelEdit}>✕</button>
                    </div>
                  </td>
                </tr>
                {errors.__add && errors.__add.length > 0 && (
                  <tr><td colSpan="5"><div className="alert alert-error" style={{fontSize:'0.7rem', padding:'4px 8px'}}>{errors.__add.join('; ')}</div></td></tr>
                )}
              </>
            )}
          </tbody>
        </table>

        {!addData && !editId && (
          <button className="btn btn-secondary btn-sm w-full mt-2" onClick={startAdd} disabled={disabled}>
            + Add Process
          </button>
        )}

        {!listValid && (
          <div className="alert alert-warning mt-2" style={{fontSize:'0.72rem'}}>
            Fix validation errors before running the simulation.
          </div>
        )}
      </div>
    </div>
  );
}
