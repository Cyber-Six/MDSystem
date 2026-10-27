import React from 'react';
import { createRoot } from 'react-dom/client';
import InitialRecordDetailModal from '../../../mds-staff/src/modules/pending-requests/components/initial-record-detail-modal.jsx';
import RecordReviewModal from '../../../mds-staff/src/modules/pending-requests/components/record-review-modal.jsx';
const fixture = window.staffFixture;
const root = createRoot(document.getElementById('root'));
window.renderStaff = () => { const Component = fixture.view === 'detail' ? InitialRecordDetailModal : RecordReviewModal; return root.render(<Component key={`${fixture.ticket.id}:${fixture.ticket.status}`} ticket={fixture.ticket} staffRole="both"
  onClose={() => { window.closedReview = true; }}
  onAction={(_, status) => { fixture.ticket.status = status; window.actions.push(status); }} />); };
window.actions = [];
window.renderStaff();
