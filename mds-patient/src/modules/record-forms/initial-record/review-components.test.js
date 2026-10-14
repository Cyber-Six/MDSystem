import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server.node';
import ReviewForm from './medical/review-form';
import EmployeeReviewForm from './employee/review-form';
import UpdateReview from '../update-record/review-step';
import { ReviewDataRow, collectUnresolvedCatalogSelections, isResolvableCatalogSelection, resolveCatalogLabel } from './review-components';

const catalog = (id, name, extra = {}) => ({ id, name, ...extra });
const catalogs = {
  medicalConditionCatalog: [catalog(101, 'QA asthma')],
  immunizationCatalog: [catalog(201, 'QA vaccine')],
  allergenCatalog: [catalog(301, 'QA pollen', { type: 'Environmental' })],
  hospitalizationCatalog: [catalog(401, 'QA hospitalization')],
  operationCatalog: [catalog(501, 'QA operation')],
  medicationCatalog: [catalog(601, 'QA medication')],
  oralApplianceCatalog: [catalog(701, 'QA retainer')],
  dentalProcedureCatalog: [catalog(801, 'QA cleaning')],
};

const initialFixture = (gender = 'Female') => ({
  personalInfo: {
    surname: 'Example', firstName: 'Patient', middleName: 'Q', suffix: 'Jr', birthday: '2000-01-02', age: 26,
    gender, civilStatus: 'Single', nationality: 'Filipino', religion: 'None', address: 'Home address',
    provinceAddress: 'Province address', contactNumber: '09170000000', program: 'BS Nursing', studentNumber: 'S-1',
    studentCategory: 'Freshman', emergencyContacts: [{ name: 'Contact QA', relationship: 'Parent', contactNumber: '09171111111', address: 'Contact address' }],
  },
  medicalHistory: { self: { 101: true }, family: { 101: true }, familyWhoHasIt: { 101: 'Mother' } },
  medicalBackground: {
    hasAllergies: 'Yes', allergies: { 301: { checked: true, severity: 'Mild', status: 'Active' } }, allergyOther: 'Allergy note',
    immunizations: { 201: true }, immunizationDates: { 201: '2025-01-02' }, immunizationDoses: { 201: 0 },
    hasHospitalization: 'Yes', hospitalizationConditions: { 401: true }, hospitalizationDates: { 401: { admissionDate: '2025-02-03', dischargeDate: '2025-02-08' } }, hospitalizationNotes: 'Hospital note',
    hasOperation: 'Yes', operationConditions: { 501: true }, operationDates: { 501: '2025-03-04' }, operationNotes: 'Surgery note',
    hasMedications: 'Yes', selectedMedications: { 601: true }, medicationReason: 'Pain relief', medicationNotes: 'Medication note',
    smoker: 'yes', smokerSticksPerDay: 0, smokerYears: 0, alcoholDrinker: 'no', vaper: 'yes', vapeType: 'Nicotine', vapeFrequency: 'Weekly',
    eyeglasses: true, contactLenses: false, gradeOD: 0, gradeOS: -1,
  },
  dentalHistory: {
    firstTimeDentist: 'no', lastDentalConsultation: '2025-04', lastDentalCleaning: '0 to 6 months ago', hasIntraOralAppliance: 'yes',
    applianceOther: 'Custom guard', intraOralAppliances: { other: { checked: true, arch: 'Upper' }, 701: { checked: true, arch: 'Lower' } },
    selectedDentalProcedures: { 801: true }, upperTeethPhoto: { name: 'upper.png', preview: 'data:image/png;base64,AA==' },
  },
  obgyne: { lastMenstrualPeriod: '2025-05-01', menarcheYearAge: '12', menstruationDuration: 5, padsPerDay: 0, dysmenorrhea: 'No' },
});

const initialProps = (formData) => ({
  formData, catalogs, certification: { verified: false }, onCertificationChange: () => {}, onClearFieldError: () => {}, onEdit: () => {},
});

describe('patient review summaries', () => {
  test('keeps zero values and multiline notes readable', () => {
    const html = renderToStaticMarkup(<><ReviewDataRow label="Daily count" value={0} /><ReviewDataRow label="Notes" value={'line one\nline two'} /></>);
    expect(html).toContain('Daily count');
    expect(html).toContain('>0<');
    expect(html).toContain('whitespace-pre-wrap');
    expect(html).toContain('line one\nline two');
  });

  test('shows Student initial values, custom choices, details, photos, and female fields', () => {
    const html = renderToStaticMarkup(<ReviewForm {...initialProps(initialFixture())} />);
    for (const value of ['QA asthma', 'Mother', 'QA vaccine', '2025', 'QA pollen', 'Environmental', 'Mild', 'Active', 'QA hospitalization', 'Admitted:', 'QA operation', 'QA medication', 'Pain relief', '0 sticks/day', 'Custom guard', 'Upper', 'upper.png', 'Menarche Year/Age']) expect(html).toContain(value);
    expect(html).not.toContain('undefined');
  });

  test('shows Employee initial values with the employee fields and photos', () => {
    const fixture = initialFixture();
    fixture.personalInfo = { ...fixture.personalInfo, employeeId: 'E-1', activeEmail: 'qa@example.test', department: 'Science', employmentCategory: 'Other', employmentCategoryOther: 'Research officer', position: 'Analyst', branch: 'QuezonCity' };
    fixture.dentalHistory.lowerTeethPhoto = { name: 'lower.png', preview: 'data:image/png;base64,AA==' };
    const html = renderToStaticMarkup(<EmployeeReviewForm {...initialProps(fixture)} />);
    for (const value of ['E-1', 'Research officer', 'QA asthma', 'QA vaccine', 'QA medication', 'Pain relief', 'upper.png', 'lower.png', 'Research officer']) expect(html).toContain(value);
    expect(html).not.toContain('undefined');
  });

  test('shows update details and resolves catalog labels for medical and dental edits', () => {
    const update = {
      catalogRegistry: {
        medicalConditions: { 101: catalog(101, 'QA asthma') }, allergens: { 301: catalog(301, 'QA pollen', { type: 'Environmental' }) },
        immunizations: { 201: catalog(201, 'QA vaccine') }, hospitalizations: { 401: catalog(401, 'QA hospitalization') },
        operations: { 501: catalog(501, 'QA operation') }, medications: { 601: catalog(601, 'QA medication') },
      dentalProcedures: { 801: catalog(801, 'QA cleaning') }, oralAppliances: { 701: catalog(701, 'QA retainer') },
      },
      firstName: 'Patient', lastName: 'Example', studentId: 'S-1', program: 'BS Nursing', age: 26, sex: 'Female', homeAddress: 'Home address',
      selfConditions: { 101: true }, familyConditions: { 101: { checked: true, relationship: 'Mother' } },
      hasAllergies: 'yes', selectedAllergies: [301], allergyDetails: { 301: { severity: 'Mild', status: 'Active' } },
      immunizations: [201], immunizationDetails: { 201: { date: '2025-01-02', doseNumber: 2 } },
      hasHospitalizations: 'yes', hospitalizationConditions: { 401: true }, hospitalizationDates: { 401: { admissionDate: '2025-02-03', dischargeDate: '2025-02-08' } },
      hasSurgeries: 'yes', operationConditions: { 501: true }, operationDates: { 501: '2025-03-04' },
      hasMedications: 'yes', selectedMedications: { 601: true }, medicationNotes: 'Two lines\nfollow-up',
      smoker: 'yes', smokerSticksPerDay: '0', smokerYears: '0', alcoholDrinker: 'no', vaper: 'no', visualAcuity: 'yes', rightEye: '0', leftEye: '-1',
      lastMenstrualPeriod: '2025-05-01', dysmenorrhea: 'no', seenByDentist: true, purpose: 'Pain', lastVisitDate: '2025-04-01',
      hasOralAppliances: true, oralAppliances: [{ tagId: 701, arch: 'Upper', status: 'Active', dateIssued: '2024-06-01' }],
      dentalProcedures: [{ procedureTypeId: 801, procedureDate: '2025-06-01' }],
      upperTeethPhoto: { name: 'update-upper.png', preview: 'data:image/png;base64,AA==' },
    };
    const html = renderToStaticMarkup(<UpdateReview formData={update} recordType="both" steps={['Personal Info', 'Medical History', 'Dental History', 'Review & Submit']} onEdit={() => {}} />);
    for (const value of ['QA asthma', 'Mother', 'QA pollen', 'QA vaccine', 'Dose:', 'QA hospitalization', 'QA operation', 'QA medication', 'Two lines', 'Right eye', 'QA cleaning', 'Upper', 'update-upper.png']) expect(html).toContain(value);
    expect(html).not.toContain('undefined');
  });
});

test('catalog labels require a valid ID and a resolvable name', () => {
  expect(resolveCatalogLabel([catalog(7, 'Choice')], 7)).toBe('Choice');
  expect(isResolvableCatalogSelection([catalog(7, 'Choice')], 7)).toBe(true);
  expect(isResolvableCatalogSelection([], 'undefined')).toBe(false);
});

test('flags active catalog selections that cannot be resolved and ignores deselected choices', () => {
  expect(collectUnresolvedCatalogSelections({ medicalHistory: { self: { 9: true, 10: false } } }, { medicalConditionCatalog: [catalog(9, 'Known')] })).toEqual([]);
  expect(collectUnresolvedCatalogSelections({ medicalHistory: { self: { 9: true } } }, { medicalConditionCatalog: [] })).toEqual([['medicalConditionCatalog', '9']]);
});

test('shows a correction action and blocks certification for unresolved selections', () => {
  const fixture = initialFixture();
  fixture.medicalHistory.self = { 999: true };
  const html = renderToStaticMarkup(<ReviewForm {...initialProps(fixture)} />);
  expect(html).toContain('Edit affected section');
  expect(html).toContain('Unresolved choice (999)');
  expect(html).toMatch(/<input[^>]*disabled=""/);
});
