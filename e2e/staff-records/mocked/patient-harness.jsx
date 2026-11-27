import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import Personal from '../../../mds-patient/src/modules/record-forms/initial-record/medical/personal-info.jsx';
import EmployeePersonal from '../../../mds-patient/src/modules/record-forms/initial-record/employee/personal-info.jsx';
import History from '../../../mds-patient/src/modules/record-forms/initial-record/medical/medical-history.jsx';
import Background from '../../../mds-patient/src/modules/record-forms/initial-record/medical/medical-background.jsx';
import Dental from '../../../mds-patient/src/modules/record-forms/initial-record/medical/dental-history.jsx';
import Review from '../../../mds-patient/src/modules/record-forms/initial-record/medical/review-form.jsx';
import UpdatePersonal from '../../../mds-patient/src/modules/record-forms/update-record/personal-info-step.jsx';
import UpdateMedical from '../../../mds-patient/src/modules/record-forms/update-record/medical-history-step.jsx';
import UpdateDental from '../../../mds-patient/src/modules/record-forms/update-record/dental-history-step.jsx';
import UpdateReview from '../../../mds-patient/src/modules/record-forms/update-record/review-step.jsx';
import { mapRevisionDataToFormData as initialMapper } from 'qa-initial-mapper';
import { mapRevisionDataToFormData as updateMapper } from 'qa-update-mapper';
const fixture = window.patientFixture;
const record = fixture.record;
const raw = { ...record, emrProfile: record.profile, visualAcuity: record.visualAcuityProfile, oralAppliance: record.oralApplianceProfile, obgyne: record.obgynHistory, patientBasicInfo: { ...record.personalInfo, profile_type: fixture.role } };
const photo = name => ({ name, preview: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="yellow"/></svg>') });
async function start() {
  const update = fixture.kind === 'update';
  const initial = initialMapper({ personalLog: record.personalInfo }, raw);
  initial.personalInfo.programId = '109';
  initial.dentalHistory.upperTeethPhoto = photo('QA upper.png');
  initial.dentalHistory.lowerTeethPhoto = photo('QA lower.png');
  const mapped = update ? await updateMapper(raw) : initial;
  if (update) Object.assign(mapped, { firstName: record.personalInfo.first_name, lastName: record.personalInfo.last_name, sex: 'Female', profileType: fixture.role,
    upperTeethPhoto: photo('QA upper.png'), lowerTeethPhoto: photo('QA lower.png') });
  const catalogs = window.patientFixture.catalogs;
  function App() {
    const [data, setData] = useState(mapped), [step, setStep] = useState(0);
    window.patientFormData = data;
    const change = section => value => setData(previous => ({ ...previous, [section]: value }));
    const registerCatalogItem = React.useCallback((domain, item) => setData(previous => {
      if (JSON.stringify(previous.catalogRegistry?.[domain]?.[item.id]) === JSON.stringify(item)) return previous;
      return { ...previous, catalogRegistry: { ...previous.catalogRegistry, [domain]: { ...previous.catalogRegistry?.[domain], [item.id]: item } } };
    }), []);
    const props = { formData: data, onChange: setData, onCatalogItemSelected: registerCatalogItem };
    const steps = update ? ['Personal Info', 'Medical History', 'Dental History', 'Review'] : ['Personal Information', 'Medical History', 'Medical Background', 'Dental History', 'Review'];
    return <><p>{fixture.instruction}</p><div data-patient-step={steps[step]}>
      {update ? <>{step === 0 && <UpdatePersonal {...props} />}{step === 1 && <UpdateMedical {...props} />}{step === 2 && <UpdateDental {...props} />}
        {step === 3 && <UpdateReview formData={data} recordType="both" steps={steps} onEdit={setStep} />}</> : <>
        {step === 0 && (fixture.role === 'Employee' ? <EmployeePersonal data={data.personalInfo} onChange={change('personalInfo')} /> : <Personal data={data.personalInfo} onChange={change('personalInfo')} />)}
        {step === 1 && <History data={data.medicalHistory} onChange={change('medicalHistory')} medicalConditionCatalog={catalogs.medicalConditionCatalog} />}
        {step === 2 && <Background data={data.medicalBackground} onChange={change('medicalBackground')} {...catalogs} />}
        {step === 3 && <Dental data={data.dentalHistory} onChange={change('dentalHistory')} {...catalogs} />}
        {step === 4 && <Review formData={data} catalogs={catalogs} onEdit={setStep} certification={{ verified: false }} onCertificationChange={() => {}} />}</>}
      </div><button onClick={() => setStep(Math.max(0, step - 1))}>QA previous section</button><button onClick={() => setStep(Math.min(steps.length - 1, step + 1))}>QA next section</button></>;
  }
  createRoot(document.getElementById('root')).render(<App />);
}
start().catch(error => { document.getElementById('root').textContent = error.stack; });
