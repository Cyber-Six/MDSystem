import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.node';
import PatientTypeBadge from './patient-type-badge';

test.each(['Student', 'Employee'])('labels the patient as %s', profileType => {
  const html = renderToStaticMarkup(<PatientTypeBadge profileType={profileType} />);
  expect(html).toContain(`aria-label="Patient type: ${profileType}"`);
  expect(html).toContain(`>${profileType}</span>`);
});
test.each([null, undefined, '', 'Other', 'constructor'])('handles an unavailable type %p', profileType => {
  const html = renderToStaticMarkup(<PatientTypeBadge profileType={profileType} />);
  expect(html).toContain('aria-label="Patient type: Type unavailable"');
  expect(html).toContain('>Type unavailable</span>');
});
