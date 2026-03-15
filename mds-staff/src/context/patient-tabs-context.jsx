// @refresh reset
import React, { createContext, useContext, useState, useCallback } from 'react';
import { formatPatientName } from '../services/patient-search-service';

const SECTION_LABELS = {
  personal:     'Full Details',
  medical:      'Medical',
  dental:       'Dental',
  appointments: 'Appointments',
  history:      'History',
  obgyne:       'OB-GYN',
  medicines:    'Medicines',
  documents:    'Documents',
};

const PatientTabsContext = createContext(null);

export function PatientTabsProvider({ children }) {
  const [tabs, setTabs] = useState([]);
  const [activeTabId, setActiveTabId] = useState(null); // null = search view

  const openTab = useCallback((patient, section) => {
    const tabId = `${patient.id}-${section}`;

    setTabs((prev) => {
      // If tab already exists, just switch to it
      if (prev.find((t) => t.id === tabId)) return prev;
      return [
        ...prev,
        {
          id: tabId,
          patientId: String(patient.id),
          patientName: formatPatientName(patient),
          section,
          label: SECTION_LABELS[section] || section,
        },
      ];
    });

    setActiveTabId(tabId);
  }, []);

  const closeTab = useCallback((tabId) => {
    setTabs((prev) => {
      const closedIndex = prev.findIndex((t) => t.id === tabId);
      const newTabs = prev.filter((t) => t.id !== tabId);
      return newTabs;
    });

    setActiveTabId((currentId) => {
      if (currentId !== tabId) return currentId;
      // Closing the active tab — pick an adjacent tab or go back to search
      return null;
    });
  }, []);

  const switchToSearch = useCallback(() => {
    setActiveTabId(null);
  }, []);

  const reorderTabs = useCallback((fromId, toId) => {
    setTabs((prev) => {
      const from = prev.findIndex((t) => t.id === fromId);
      const to   = prev.findIndex((t) => t.id === toId);
      if (from === -1 || to === -1 || from === to) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }, []);

  return (
    <PatientTabsContext.Provider
      value={{ tabs, activeTabId, openTab, closeTab, setActiveTabId, switchToSearch, reorderTabs }}
    >
      {children}
    </PatientTabsContext.Provider>
  );
}

export function usePatientTabs() {
  const ctx = useContext(PatientTabsContext);
  if (!ctx) throw new Error('usePatientTabs must be used within PatientTabsProvider');
  return ctx;
}
