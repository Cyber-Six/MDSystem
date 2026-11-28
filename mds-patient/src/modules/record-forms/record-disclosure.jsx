import React from 'react';

export default function RecordDisclosure({ open, id, children }) {
  return (
    <div id={id} className="record-disclosure" data-open={open} inert={!open}>
      <div className="record-disclosure-inner">{children}</div>
    </div>
  );
}
