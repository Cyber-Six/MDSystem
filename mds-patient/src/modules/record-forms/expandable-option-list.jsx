import React from 'react';

const DEFAULT_VISIBLE_COUNT = 12;

export default function ExpandableOptionList({ items = [], renderItem, className = 'space-y-2', initialCount = DEFAULT_VISIBLE_COUNT, isSelected }) {
  const orderedItems = isSelected ? [...items].sort((a, b) => Number(isSelected(b)) - Number(isSelected(a))) : items;
  const visibleItems = orderedItems.slice(0, initialCount);

  return (
    <>
      <div className={className}>{visibleItems.map(renderItem)}</div>
      {items.length > initialCount && (
        <div className="mt-3 flex items-center gap-3 text-sm">
          <span className="text-secondary-500 dark:text-neutral-400">
            Showing the first {initialCount} of {items.length}. Use the search below to find another option.
          </span>
        </div>
      )}
    </>
  );
}
