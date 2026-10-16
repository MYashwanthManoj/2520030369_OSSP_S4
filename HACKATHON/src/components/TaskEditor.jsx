/**
 * TaskEditor.jsx — Process Configuration Workbench
 * Part of The Computing Instrument design system.
 * Zero emojis, clear field labels, and inline validation.
 */
import { useState } from 'react';
import { EXAMPLE_WORKLOADS } from '../engine/scheduler.js';
import { validateProcess } from '../engine/validation.js';

const COLORS = [
  '#4263EB', /* Electric Cobalt   */
  '#28B8D5', /* Precision Cyan    */
  '#F0B64A', /* Signal Amber      */
  '#E96B56', /* Execution Coral   */
  '#389B78', /* Success Green     */
  '#9B87D8', /* Muted Violet      */
  '#D97706', /* Deep Terracotta   */
  '#6366F1', /* Indigo            */
];

const PRESETS = [
  { key: 'normal',       label: 'Standard Mix' },
  { key: 'simultaneous', label: 'Simultaneous' },
  { key: 'idleGap',      label: 'Intermittent Idle' },
  { key: 'starvation',   label: 'Priority Starvation' },
  { key: 'aging',        label: 'Aging Demonstration' },
];

let _nextId = 5;

export default function TaskEditor({ processes, onProcessesChange, disabled }) {
  const [errors, setErrors] = useState({});

  function updateField(idx, field, rawValue) {
    const value = field === 'id' ? rawValue : rawValue === '' ? '' : Number(rawValue);
    const updated = processes.map((p, i) => i === idx ? { ...p, [field]: value } : p);

    const existingIds = updated.filter((_, i) => i !== idx).map(p => p.id);
    const result = validateProcess(updated[idx], existingIds);
    setErrors(prev => ({ ...prev, [idx]: result.valid ? null : result.errors.join(' ') }));

    onProcessesChange(updated);
  }

  function addTask() {
    const id = `P${_nextId++}`;
    onProcessesChange([
      ...processes,
      { id, arrivalTime: 0, burstTime: 4, priority: 2 },
    ]);
  }

  function removeTask(idx) {
    const updated = processes.filter((_, i) => i !== idx);
    const newErrors = {};
    Object.keys(errors).forEach(k => {
      const ki = Number(k);
      if (ki < idx) newErrors[ki] = errors[ki];
      else if (ki > idx) newErrors[ki - 1] = errors[ki];
    });
    setErrors(newErrors);
    onProcessesChange(updated);
  }

  function loadPreset(key) {
    const workload = EXAMPLE_WORKLOADS[key];
    if (!workload) return;
    setErrors({});
    onProcessesChange(workload.processes.map(p => ({ ...p })));
  }

  return (
    <div className="side-panel" id="sim-task-editor">
      <div className="side-panel-header">
        <span className="side-panel-title">WORKLOAD CONFIGURATION</span>
      </div>

      {/* Preset Selectors */}
      <div className="preset-selector-strip">
        <span className="preset-group-label">Presets:</span>
        <div className="preset-pills-row">
          {PRESETS.map(p => (
            <button
              key={p.key}
              className="preset-btn"
              onClick={() => !disabled && loadPreset(p.key)}
              disabled={disabled}
              title={EXAMPLE_WORKLOADS[p.key]?.description}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Process Table Header */}
      <div className="editor-table-header">
        <span className="th-cell th-id">ID</span>
        <span className="th-cell th-arrival">Arrival</span>
        <span className="th-cell th-burst">Burst</span>
        <span className="th-cell th-prio">Priority</span>
        <span className="th-cell th-action"></span>
      </div>

      {/* Process Rows */}
      <div className="editor-row-list">
        {processes.map((p, idx) => {
          const color = COLORS[idx % 8];
          const err = errors[idx];
          return (
            <div key={idx} className="editor-row-container">
              <div
                className={`editor-input-row ${err ? 'has-error' : ''}`}
                style={{ borderLeftColor: color }}
              >
                <input
                  className="input-cell id-cell"
                  value={p.id}
                  onChange={e => updateField(idx, 'id', e.target.value)}
                  disabled={disabled}
                  maxLength={5}
                  aria-label="Process ID"
                />

                <input
                  className="input-cell"
                  type="number"
                  min={0}
                  max={99}
                  value={p.arrivalTime}
                  onChange={e => updateField(idx, 'arrivalTime', e.target.value)}
                  disabled={disabled}
                  aria-label="Arrival timestamp"
                />

                <input
                  className="input-cell"
                  type="number"
                  min={1}
                  max={99}
                  value={p.burstTime}
                  onChange={e => updateField(idx, 'burstTime', e.target.value)}
                  disabled={disabled}
                  aria-label="Burst duration"
                />

                <input
                  className="input-cell"
                  type="number"
                  min={0}
                  max={20}
                  value={p.priority}
                  onChange={e => updateField(idx, 'priority', e.target.value)}
                  disabled={disabled}
                  aria-label="Base priority"
                />

                <button
                  className="btn-remove-row"
                  onClick={() => !disabled && removeTask(idx)}
                  disabled={disabled || processes.length <= 1}
                  title="Remove this process"
                  aria-label={`Remove process ${p.id}`}
                >
                  Delete
                </button>
              </div>

              {err && (
                <div className="row-validation-error" role="alert">
                  {err}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Process Action */}
      <div className="editor-actions-strip">
        <button
          className="btn-add-process"
          onClick={addTask}
          disabled={disabled || processes.length >= 8}
          title="Add another process (maximum 8)"
        >
          Add Process
        </button>
        <span className="prio-help-caption">Priority: 0 is highest urgency</span>
      </div>
    </div>
  );
}
