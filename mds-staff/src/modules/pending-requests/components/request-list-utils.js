export const STATUS_OPTIONS = [
  { value: 'Pending', label: 'Pending' },
  { value: 'RevisionSubmitted', label: 'Revision submitted' },
  { value: 'Approved', label: 'Approved' },
  { value: 'Revision', label: 'Revision requested' },
  { value: 'Rejected', label: 'Rejected' },
  { value: 'Expired', label: 'Expired' },
  { value: 'Cancelled', label: 'Cancelled' },
];

export function matchesRequestSearch(ticket, query) {
  const term = query.trim().toLocaleLowerCase();
  const name = `${ticket.first_name || ''} ${ticket.last_name || ''}`.trim().toLocaleLowerCase();
  const normalizedTerm = term.replace(/^#/, '');
  return !term || name.includes(term)
    || String(ticket.email || '').toLocaleLowerCase().includes(term)
    || String(ticket.identifier || '').toLocaleLowerCase().includes(term)
    || String(ticket.patientId || '').toLocaleLowerCase().includes(normalizedTerm)
    || String(ticket.id).toLocaleLowerCase().includes(normalizedTerm);
}

