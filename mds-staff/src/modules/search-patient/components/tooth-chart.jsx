import React, { useState, useEffect } from 'react';
import { LEGENDS, TOOTH_LAYOUT, getLegend } from './tooth-chart-constants';

/* ─── Tooth Button Component ──────────────────────────────────── */
function Tooth({ number, state, onToothClick, hoveredTooth, onHover, selectedLegend, isEditing }) {
  const legend = state ? getLegend(state) : null;
  const isHovered = hoveredTooth === number;

  return (
    <div className="relative group">
      <button
        onClick={() => isEditing && onToothClick(number)}
        onMouseEnter={() => onHover(number)}
        onMouseLeave={() => onHover(null)}
        disabled={!isEditing}
        className={`
          w-10 h-14 md:w-12 md:h-16 rounded-2xl transition-all duration-200
          flex flex-col items-center justify-center gap-0.5
          border
          ${isEditing ? 'hover:scale-105 hover:shadow-md active:scale-95' : ''}
          ${legend ? legend.color : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-600'}
          ${isHovered && isEditing ? 'ring-2 ring-primary-500 ring-offset-1' : ''}
          ${isEditing && selectedLegend ? 'cursor-pointer' : isEditing ? 'cursor-not-allowed opacity-60' : 'cursor-default'}
        `}
      >
        <span className={`text-[10px] font-medium ${legend ? legend.textColor : 'text-neutral-500 dark:text-neutral-400'}`}>
          {number}
        </span>
        {legend && (
          <span className={`text-base font-bold leading-none ${legend.textColor}`}>
            {legend.code}
          </span>
        )}
      </button>

      {/* Tooltip */}
      {isHovered && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2.5 py-1.5 bg-neutral-900 text-white text-[11px] rounded-lg shadow-lg whitespace-nowrap animate-fade-in pointer-events-none">
          <div className="font-semibold">Tooth {number}</div>
          {legend && <div className="text-neutral-300">{legend.label}</div>}
          {!legend && <div className="text-neutral-400">No condition</div>}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-neutral-900" />
        </div>
      )}
    </div>
  );
}

/* ─── Legend Palette Component ────────────────────────────────── */
function LegendPalette({ selectedLegend, onSelectLegend, compact = false }) {
  if (compact) {
    // Compact mode now shows code + label in a grid
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
        {LEGENDS.map(legend => (
          <button
            key={legend.code}
            onClick={() => onSelectLegend(selectedLegend === legend.code ? null : legend.code)}
            className={`
              flex items-center gap-2 px-2 py-1.5 rounded-md transition-all text-left
              ${legend.color}
              ${selectedLegend === legend.code ? 'ring-2 ring-primary-500 ring-offset-1 dark:ring-offset-neutral-800' : 'hover:scale-[1.02]'}
            `}
          >
            <span className={`text-sm font-bold ${legend.textColor}`}>{legend.code}</span>
            <span className={`text-[10px] truncate ${legend.textColor}`}>{legend.label}</span>
          </button>
        ))}
      </div>
    );
  }

  // Expanded mode shows full details
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
      {LEGENDS.map(legend => (
        <button
          key={legend.code}
          onClick={() => onSelectLegend(selectedLegend === legend.code ? null : legend.code)}
          className={`
            flex items-center gap-2.5 p-2.5 rounded-lg border-2 transition-all text-left
            ${selectedLegend === legend.code
              ? 'border-primary-500 ring-1 ring-primary-200 bg-primary-50 dark:bg-primary-900/20'
              : 'border-neutral-200 dark:border-neutral-600 hover:border-primary-300 bg-white dark:bg-neutral-800'}
          `}
        >
          <div className={`w-9 h-9 rounded-md flex items-center justify-center text-sm font-bold ${legend.color} ${legend.textColor}`}>
            {legend.code}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-xs font-medium text-secondary-700 dark:text-neutral-200 block truncate">
              {legend.label}
            </span>
            <span className="text-[10px] text-secondary-400 dark:text-neutral-500">
              Code: {legend.code}
            </span>
          </div>
          {selectedLegend === legend.code && (
            <div className="w-5 h-5 rounded-full bg-primary-500 flex items-center justify-center flex-shrink-0">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
        </button>
      ))}
    </div>
  );
}

/* ─── Chart Stats Component ────────────────────────────────────── */
function ChartStats({ toothStates }) {
  const markedCount = Object.keys(toothStates).length;
  const getCategoryCount = (code) => Object.values(toothStates).filter(s => s === code).length;

  const stats = [
    { label: 'Marked', value: markedCount, color: 'text-primary-600 dark:text-primary-400' },
    { label: 'Missing', value: getCategoryCount('M'), color: 'text-neutral-600 dark:text-neutral-400' },
    { label: 'Filled', value: getCategoryCount('F'), color: 'text-green-600 dark:text-green-400' },
    { label: 'For Extraction', value: getCategoryCount('X'), color: 'text-red-600 dark:text-red-400' },
    { label: 'For Filling', value: getCategoryCount('C'), color: 'text-blue-600 dark:text-blue-400' },
  ];

  return (
    <div className="flex flex-wrap gap-6 text-xs">
      {stats.map(({ label, value, color }) => (
        <div key={label} className="text-center">
          <div className={`text-xl font-bold ${color}`}>{value}</div>
          <div className="text-neutral-500 dark:text-neutral-400">{label}</div>
        </div>
      ))}
    </div>
  );
}

/* ─── Helper: Initialize all teeth as Caries-free ─────────────── */
function initializeDefaultStates(initialStates) {
  // If initialStates is provided and not empty, use it
  if (initialStates && Object.keys(initialStates).length > 0) {
    return initialStates;
  }

  // Otherwise, mark all 32 teeth as Caries-free (✓)
  const defaultStates = {};
  const allTeeth = [
    ...TOOTH_LAYOUT.upper.right,
    ...TOOTH_LAYOUT.upper.left,
    ...TOOTH_LAYOUT.lower.right,
    ...TOOTH_LAYOUT.lower.left,
  ];

  allTeeth.forEach(toothNumber => {
    defaultStates[toothNumber] = '✓';
  });

  return defaultStates;
}

/* ─── Main ToothChart Component ────────────────────────────────── */
export default function ToothChart({
  initialStates = {},
  onSave,
  patientId,
  readOnly = false
}) {
  const [toothStates, setToothStates] = useState(() => initializeDefaultStates(initialStates));
  const [selectedLegend, setSelectedLegend] = useState(null);
  const [hoveredTooth, setHoveredTooth] = useState(null);
  const [previousState, setPreviousState] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [showLegendPanel, setShowLegendPanel] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setToothStates(initializeDefaultStates(initialStates));
  }, [initialStates]);

  const handleToothClick = (toothNumber) => {
    if (!selectedLegend || !isEditing) return;

    setPreviousState({ ...toothStates });

    // Toggle off if same legend is already applied
    if (toothStates[toothNumber] === selectedLegend) {
      const newStates = { ...toothStates };
      delete newStates[toothNumber];
      setToothStates(newStates);
    } else {
      setToothStates({ ...toothStates, [toothNumber]: selectedLegend });
    }
  };

  const handleUndo = () => {
    if (previousState) {
      setToothStates(previousState);
      setPreviousState(null);
    }
  };

  const handleReset = () => {
    if (Object.keys(toothStates).length === 0) return;
    if (confirm('Reset all teeth to Caries-free?')) {
      setPreviousState({ ...toothStates });
      setToothStates(initializeDefaultStates({}));
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (onSave) {
        await onSave(toothStates);
      }
      setIsEditing(false);
      setPreviousState(null);
    } catch (error) {
      console.error('Failed to save tooth chart:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setToothStates(initializeDefaultStates(initialStates));
    setIsEditing(false);
    setSelectedLegend(null);
    setPreviousState(null);
  };

  const renderJaw = (jawData, label) => (
    <div className="mb-5">
      <div className="text-center mb-3">
        <span className="text-xs font-semibold text-secondary-600 dark:text-neutral-400 uppercase tracking-wider">
          {label}
        </span>
      </div>
      <div className="flex justify-center gap-4 md:gap-6">
        <div className="flex gap-1">
          {jawData.right.map(num => (
            <Tooth
              key={num}
              number={num}
              state={toothStates[num]}
              onToothClick={handleToothClick}
              hoveredTooth={hoveredTooth}
              onHover={setHoveredTooth}
              selectedLegend={selectedLegend}
              isEditing={isEditing}
            />
          ))}
        </div>
        <div className="w-px bg-neutral-300 dark:bg-neutral-600" />
        <div className="flex gap-1">
          {jawData.left.map(num => (
            <Tooth
              key={num}
              number={num}
              state={toothStates[num]}
              onToothClick={handleToothClick}
              hoveredTooth={hoveredTooth}
              onHover={setHoveredTooth}
              selectedLegend={selectedLegend}
              isEditing={isEditing}
            />
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Header with controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          {isEditing && selectedLegend && (
            <div className={`px-2.5 py-1 rounded-md text-xs font-semibold ${getLegend(selectedLegend)?.color} ${getLegend(selectedLegend)?.textColor}`}>
              {selectedLegend} - {getLegend(selectedLegend)?.label}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {!readOnly && !isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="px-3 py-1.5 text-xs font-medium bg-primary-500 hover:bg-primary-600 text-white rounded-md transition-colors flex items-center gap-1.5"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              Edit Chart
            </button>
          )}

          {isEditing && (
            <>
              <button
                onClick={handleUndo}
                disabled={!previousState}
                className="p-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded disabled:opacity-40"
                title="Undo"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
                </svg>
              </button>
              <button
                onClick={handleReset}
                className="p-1.5 text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded"
                title="Reset"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
              <button
                onClick={handleCancel}
                className="px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="px-3 py-1.5 text-xs font-medium bg-success-500 hover:bg-success-600 text-white rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {isSaving ? (
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                )}
                Save
              </button>
            </>
          )}
        </div>
      </div>

      {/* Legend Palette (when editing) */}
      {isEditing && (
        <div className="p-3 bg-neutral-50 dark:bg-neutral-700/50 rounded-lg border border-neutral-200 dark:border-neutral-600">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-secondary-600 dark:text-neutral-400 uppercase tracking-wider">
              Select Legend
            </span>
            <button
              onClick={() => setShowLegendPanel(!showLegendPanel)}
              className="text-xs text-primary-600 hover:text-primary-700 dark:text-primary-400 font-medium"
            >
              {showLegendPanel ? 'Compact View' : 'Expanded View'}
            </button>
          </div>
          <LegendPalette
            selectedLegend={selectedLegend}
            onSelectLegend={setSelectedLegend}
            compact={!showLegendPanel}
          />
        </div>
      )}

      {/* Tooth Chart Grid */}
      <div className="py-3 overflow-x-auto">
        <div className="min-w-fit">
          {renderJaw(TOOTH_LAYOUT.upper, 'Upper Jaw')}
          <div className="h-px bg-neutral-200 dark:bg-neutral-700 my-4 mx-auto max-w-md" />
          {renderJaw(TOOTH_LAYOUT.lower, 'Lower Jaw')}
        </div>
      </div>

      {/* Stats */}
      {Object.keys(toothStates).length > 0 && (
        <div className="pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <ChartStats toothStates={toothStates} />
        </div>
      )}
    </div>
  );
}
