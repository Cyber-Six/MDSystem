import React from 'react';
import { Input, Select } from './form-elements';
import { searchStudentProgram } from '../../../../services/emr-service';

const PersonalInfoForm = ({ data, onChange, fieldErrors = {}, onClearFieldError = () => {} }) => {
  const handleChange = (field, value) => {
    // Clear error for this field when user starts typing
    onClearFieldError(field);
    onChange({ ...data, [field]: value });
  };

  const [phoneWarnings, setPhoneWarnings] = React.useState({});

  // Strip non-phone chars and enforce a maximum of 11 digits
  const handlePhone = (fieldKey, rawVal) => {
    const filtered = rawVal.replace(/[^\d+\-\s()]/g, '');
    const digits = filtered.replace(/\D/g, '');
    if (digits.length > 11) {
      let digitCount = 0;
      let result = '';
      for (const char of filtered) {
        if (/\d/.test(char)) {
          if (digitCount >= 11) break;
          digitCount++;
        }
        result += char;
      }
      setPhoneWarnings(prev => ({ ...prev, [fieldKey]: true }));
      return result;
    }
    setPhoneWarnings(prev => ({ ...prev, [fieldKey]: false }));
    return filtered;
  };
  // Strip any character that is not alphanumeric or a dash
  const filterStudentNumber = (val) => val.replace(/[^a-zA-Z0-9\-]/g, '');

  const handleEmergencyContactChange = (index, field, value) => {
    // Clear error for this emergency contact field when user starts typing
    const fieldName = `emergencyContact${index + 1}${field.charAt(0).toUpperCase() + field.slice(1)}`;
    onClearFieldError(fieldName);
    const contacts = [...data.emergencyContacts];
    contacts[index] = { ...contacts[index], [field]: value };
    onChange({ ...data, emergencyContacts: contacts });
  };

  const programOptions = [];

  // Program search state
  const [programInput, setProgramInput] = React.useState(data.program || '');
  const [programSuggestions, setProgramSuggestions] = React.useState([]);
  const [programSearching, setProgramSearching] = React.useState(false);
  const [programFocused, setProgramFocused] = React.useState(false);
  const programWrapperRef = React.useRef(null);
  const programDebounceRef = React.useRef(null);

  // Sync programInput display when data.program changes (e.g. revision prefill)
  React.useEffect(() => {
    setProgramInput(data.program || '');
  }, [data.program]);

  // Close dropdown on outside click
  React.useEffect(() => {
    const handler = (e) => {
      if (programWrapperRef.current && !programWrapperRef.current.contains(e.target)) {
        setProgramFocused(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleProgramInputChange = (value) => {
    setProgramInput(value);
    // Clear the stored selection when user edits the field
    if (data.programId) {
      onChange({ ...data, program: '', programId: '' });
    }
    onClearFieldError('program');
    if (programDebounceRef.current) clearTimeout(programDebounceRef.current);
    if (!value.trim()) { setProgramSuggestions([]); return; }
    programDebounceRef.current = setTimeout(async () => {
      setProgramSearching(true);
      try {
        const results = await searchStudentProgram(value.trim());
        setProgramSuggestions(results);
      } catch {
        setProgramSuggestions([]);
      } finally {
        setProgramSearching(false);
      }
    }, 300);
  };

  const selectProgram = (item) => {
    setProgramInput(item.label);
    setProgramFocused(false);
    setProgramSuggestions([]);
    onChange({ ...data, program: item.label, programId: item.id });
    onClearFieldError('program');
  };

  const studentCategoryOptions = [
    { value: 'Grade11', label: 'Grade 11' },
    { value: 'Grade12', label: 'Grade 12' },
    { value: 'Freshman', label: 'Freshman' },
    { value: 'Sophomore', label: 'Sophomore' },
    { value: 'Junior', label: 'Junior' },
    { value: 'Senior', label: 'Senior' },
    { value: 'Masteral', label: 'Masteral' },
    { value: 'Doctorate', label: 'Doctorate' },
  ];

  const calculateAge = (birthday) => {
    if (!birthday) return '';
    const today = new Date();
    const birthDate = new Date(birthday);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  React.useEffect(() => {
    if (data.birthday) {
      const age = calculateAge(data.birthday);
      if (age !== data.age) {
        handleChange('age', age);
      }
    }
  }, [data.birthday]);

  return (
    <div className="space-y-4">
      {/* ── Personal Information Card ── */}
      <div className="form-section">
        <h3 className="text-lg font-heading font-semibold text-secondary-900 mb-5 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 text-primary-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </span>
          Personal Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Surname"
            required
            value={data.surname || ''}
            onChange={(e) => handleChange('surname', e.target.value)}
            placeholder="Enter surname"
            error={fieldErrors.surname}
          />
          <Input
            label="First Name"
            required
            value={data.firstName || ''}
            onChange={(e) => handleChange('firstName', e.target.value)}
            placeholder="Enter first name"
            error={fieldErrors.firstName}
          />
          <Input
            label="Middle Name"
            value={data.middleName || ''}
            onChange={(e) => handleChange('middleName', e.target.value)}
            placeholder="Enter middle name"
          />
          <Input
            label="Suffix"
            value={data.suffix || ''}
            onChange={(e) => handleChange('suffix', e.target.value)}
            placeholder="e.g., Jr., Sr., III"
          />
          <Input
            label="Birthday"
            type="date"
            required
            value={data.birthday || ''}
            onChange={(e) => handleChange('birthday', e.target.value)}
            error={fieldErrors.birthday}
          />
          <Input
            label="Age"
            type="number"
            value={data.age || ''}
            disabled
            placeholder="Auto-calculated"
          />
          <Select
            label="Gender"
            required
            value={data.gender || ''}
            onChange={(e) => handleChange('gender', e.target.value)}
            options={[
              { value: 'Male', label: 'Male' },
              { value: 'Female', label: 'Female' },
            ]}
            error={fieldErrors.gender}
          />
          <Select
            label="Civil Status"
            required
            value={data.civilStatus || ''}
            onChange={(e) => handleChange('civilStatus', e.target.value)}
            options={[
              { value: 'Single', label: 'Single' },
              { value: 'Married', label: 'Married' },
              { value: 'Widowed', label: 'Widowed' },
              { value: 'Separated', label: 'Separated' },
            ]}
            error={fieldErrors.civilStatus}
          />
          <Input
            label="Nationality"
            required
            value={data.nationality || ''}
            onChange={(e) => handleChange('nationality', e.target.value)}
            placeholder="Enter nationality"
            error={fieldErrors.nationality}
          />
          <Input
            label="Religion"
            value={data.religion || ''}
            onChange={(e) => handleChange('religion', e.target.value)}
            placeholder="Enter religion"
          />
          <Input
            label="Personal Contact Number"
            type="tel"
            required
            reserveErrorSpace
            value={data.contactNumber || ''}
            onChange={(e) => handleChange('contactNumber', handlePhone('contactNumber', e.target.value))}
            placeholder="09XXXXXXXXX"
            className="mb-0"
            error={phoneWarnings.contactNumber ? 'Contact number cannot exceed 11 digits.' : fieldErrors.contactNumber}
          />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
          <Input
            label="Present Address"
            required
            value={data.address || ''}
            onChange={(e) => handleChange('address', e.target.value)}
            placeholder="Enter current/present address"
            error={fieldErrors.address}
          />
          <Input
            label="Province Address"
            required
            value={data.provinceAddress || ''}
            onChange={(e) => handleChange('provinceAddress', e.target.value)}
            placeholder="Enter province/permanent address"
            error={fieldErrors.provinceAddress}
          />
        </div>
      </div>

      {/* ── School Information Card ── */}
      <div className="form-section">
        <h3 className="text-lg font-heading font-semibold text-secondary-900 mb-5 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 text-primary-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </span>
          School Information
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-secondary-700 mb-1">
              Program <span className="text-red-500">*</span>
            </label>
            <div ref={programWrapperRef} className="relative">
              <input
                type="text"
                className={`w-full px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 ${fieldErrors.program ? 'border-red-400' : 'border-neutral-300'} ${data.programId ? 'bg-primary-50' : ''}`}
                placeholder="Type to search for your program..."
                value={programInput}
                autoComplete="off"
                onFocus={() => setProgramFocused(true)}
                onChange={(e) => handleProgramInputChange(e.target.value)}
              />
              {data.programId && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-primary-600 font-medium pointer-events-none">✓</span>
              )}
              {programFocused && programInput.trim() && (
                <div className="absolute z-10 mt-1 w-full border border-neutral-200 rounded-lg bg-white shadow-md">
                  {programSearching && (
                    <div className="px-4 py-2 text-xs text-secondary-400 italic">Searching...</div>
                  )}
                  {!programSearching && programSuggestions.length === 0 && (
                    <div className="px-4 py-2 text-xs text-secondary-400 italic">No programs found.</div>
                  )}
                  {programSuggestions.map(item => (
                    <button
                      key={item.id}
                      type="button"
                      className="w-full text-left px-4 py-2 text-sm text-secondary-800 hover:bg-primary-50 focus:bg-primary-50 focus:outline-none first:rounded-t-lg last:rounded-b-lg border-b border-neutral-100 last:border-0"
                      onMouseDown={(e) => { e.preventDefault(); selectProgram(item); }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {fieldErrors.program && (
              <p className="mt-1 text-xs text-red-500">{fieldErrors.program}</p>
            )}
          </div>
          <Input
            label="Student Number"
            required
            value={data.studentNumber || ''}
            onChange={(e) => handleChange('studentNumber', filterStudentNumber(e.target.value))}
            placeholder="Enter student number"
            error={fieldErrors.studentNumber}
          />
        </div>
      </div>

      {/* ── Student Status Card ── */}
      <div className="form-section">
        <h3 className="text-lg font-heading font-semibold text-secondary-900 mb-5 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary-100 text-primary-700">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </span>
          Student Status
        </h3>
        <div className="grid grid-cols-1 gap-3">
          <Select
            label="Student Category"
            required
            value={data.studentCategory || ''}
            onChange={(e) => handleChange('studentCategory', e.target.value)}
            options={studentCategoryOptions}
            error={fieldErrors.studentCategory}
          />

        </div>
      </div>

      {/* ── Emergency Contacts Card ── */}
      <div className="form-section">
        <h3 className="text-lg font-heading font-semibold text-secondary-900 mb-3 flex flex-wrap items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-error-100 text-error-600 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </span>
          Emergency Contacts
          <span className="text-xs font-normal text-secondary-500 bg-secondary-100 px-2 py-0.5 rounded-full">2 required</span>
        </h3>
        {[0, 1].map((index) => (
          <div key={index} className={`${index === 0 ? 'mb-6 pb-6 border-b border-neutral-200' : ''}`}>
            <h4 className="text-sm font-semibold text-secondary-600 mb-2 flex items-center gap-2">
              <span className="flex items-center justify-center w-5 h-5 rounded-full bg-secondary-200 text-secondary-700 text-xs font-bold">{index + 1}</span>
              Contact Person {index + 1}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
              <Input
                label="Name"
                required
                value={data.emergencyContacts[index]?.name || ''}
                onChange={(e) => handleEmergencyContactChange(index, 'name', e.target.value)}
                placeholder="Full name"
                error={index === 0 ? fieldErrors.emergencyContact1Name : fieldErrors.emergencyContact2Name}
              />
              <Input
                label="Relationship"
                required
                value={data.emergencyContacts[index]?.relationship || ''}
                onChange={(e) => handleEmergencyContactChange(index, 'relationship', e.target.value)}
                placeholder="e.g., Mother, Father"
                error={index === 0 ? fieldErrors.emergencyContact1Relationship : fieldErrors.emergencyContact2Relationship}
              />
              <Input
                label="Contact Number"
                type="tel"
                required
                reserveErrorSpace
                value={data.emergencyContacts[index]?.contactNumber || ''}
                onChange={(e) => handleEmergencyContactChange(index, 'contactNumber', handlePhone(`ec${index}`, e.target.value))}
                placeholder="09XXXXXXXXX"
                error={phoneWarnings[`ec${index}`] ? 'Contact number cannot exceed 11 digits.' : (index === 0 ? fieldErrors.emergencyContact1ContactNumber : fieldErrors.emergencyContact2ContactNumber)}
              />
            </div>
            <div className="mt-2">
              <Input
                label="Address"
                required
                value={data.emergencyContacts[index]?.address || ''}
                onChange={(e) => handleEmergencyContactChange(index, 'address', e.target.value)}
                placeholder="Complete address of contact person"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PersonalInfoForm;
