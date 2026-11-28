import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.node';
import { Input, Select, Textarea, Checkbox } from './form-elements';
import ProgressStepper from './progress-stepper';

test.each([
  ['input', Input, {}],
  ['select', Select, { options: [{ value: 'one', label: 'One' }] }],
  ['textarea', Textarea, {}],
])('links the %s label and error to the control', (tag, Component, props) => {
  const markup = renderToStaticMarkup(<Component id="fixture" label="Fixture" error="Please check this answer" {...props} />);
  expect(markup).toContain('for="fixture"');
  expect(markup).toContain('id="fixture"');
  expect(markup).toContain('aria-invalid="true"');
  expect(markup).toContain('aria-describedby="fixture-error"');
  expect(markup).toContain('id="fixture-error"');
});

test('checkbox text is part of the clickable label', () => {
  const markup = renderToStaticMarkup(<Checkbox label="Confirm answer" />);
  expect(markup).toMatch(/^<label/);
  expect(markup).toContain('<input type="checkbox"');
  expect(markup).toContain('Confirm answer');
});

test('progress identifies the current section accessibly', () => {
  const markup = renderToStaticMarkup(<ProgressStepper currentStep={1} steps={['Personal info', 'Dental history', 'Review']} />);
  expect(markup).toContain('aria-label="Record progress"');
  expect(markup).toContain('aria-current="step"');
  expect(markup).toContain('Dental history');
  expect(markup).toContain('Step 2 of 3');
});
