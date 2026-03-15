import React from 'react';
import PatientSectionCard from './section-card';

export default function PatientObgyneTab({ patient }) {
  return (
    <PatientSectionCard title="OB-GYN History" right={<span className="text-[10px] text-pink-600 dark:text-pink-400">Female only</span>}>
      <div className="grid md:grid-cols-3 gap-3 text-sm">
        <div>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400">Last Menstrual Period</p>
          <p className="font-medium text-secondary-800 dark:text-white">{patient.obgyne.lastMenstrualPeriod || 'N/A'}</p>
        </div>
        <div>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400">Menstruation Duration</p>
          <p className="font-medium text-secondary-800 dark:text-white">{patient.obgyne.menstruationDuration || 'N/A'}</p>
        </div>
        <div>
          <p className="text-[11px] text-secondary-500 dark:text-neutral-400">Dysmenorrhea</p>
          <p className="font-medium text-secondary-800 dark:text-white">{patient.obgyne.dysmenorrhea || 'N/A'}</p>
        </div>
      </div>
    </PatientSectionCard>
  );
}
