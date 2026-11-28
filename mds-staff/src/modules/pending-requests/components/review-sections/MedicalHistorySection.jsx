import React from 'react';
import SectionWrapper, { formatReviewDate, ReviewChip, ReviewGroup } from './SectionWrapper';

export default function MedicalHistorySection({ medicalHistory, catalogs = {}, isLocked = false }) {
  const conditions = medicalHistory?.conditions ?? [];
  if (!conditions.length) return null;

  const groups = [
    { title: 'Yourself', entries: conditions.filter((condition) => !condition.relationship) },
    { title: 'Family', entries: conditions.filter((condition) => condition.relationship) },
  ];

  return (
    <SectionWrapper title="Medical History" isLocked={isLocked}>
      {groups.filter(({ entries }) => entries.length > 0).map(({ title, entries }) => (
        <ReviewGroup key={title} title={title}>
          <div className="flex flex-wrap gap-2">
            {entries.map((condition) => {
              const index = conditions.indexOf(condition);
              const name = catalogs.medicalConditionCatalog?.find((item) => String(item.id) === String(condition.conditionId))?.name;
              const detail = [condition.relationship, formatReviewDate(condition.diagnosedDate), name && condition.description]
                .filter(Boolean).join(' · ');
              return (
                <ReviewChip key={condition.id ?? index} tone="condition" detail={detail} data-review-entry={`medicalHistory:${index}`}>
                  {name || condition.description || 'Unresolved choice'}
                </ReviewChip>
              );
            })}
          </div>
        </ReviewGroup>
      ))}
    </SectionWrapper>
  );
}
