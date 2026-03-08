import React, { useState, useEffect, useRef } from 'react';
import { Input, Select, Textarea, AccordionSection } from './form-elements';
import { fetchAllDentalCatalogs } from './dental-history-service';
import { useBanner } from '../../../context/banner-context';

const DentalHistoryStep = ({ formData, onChange }) => {
  const { clearAllBanners } = useBanner();
  const [activeAccordion, setActiveAccordion] = useState('visits');
  const [catalogs, setCatalogs] = useState({
    oralAppliances: [],
    dentalProcedures: [],
    isLoading: true,
    error: null
  });

  // Prevent duplicate fetch in React StrictMode (dev double-mount)
  const hasFetched = useRef(false);

  // Fetch catalogs on mount
  useEffect(() => {
    if (hasFetched.current) return;
    hasFetched.current = true;

    let isMounted = true;
    
    const loadCatalogs = async () => {
      try {
        console.log('📥 Loading dental catalogs...');
        const result = await fetchAllDentalCatalogs();
        
        if (isMounted) {
          setCatalogs({
            ...result,
            isLoading: false,
            error: result.error
          });
          clearAllBanners();
          console.log('✅ Dental catalogs loaded');
        }
      } catch (err) {
        if (isMounted) {
          console.error('❌ Failed to load dental catalogs:', err);
          setCatalogs(prev => ({
            ...prev,
            isLoading: false,
            error: err.message
          }));
        }
      }
    };

    loadCatalogs();
    
    return () => { isMounted = false; };
  }, []);

  const handleInputChange = (field, value) => {
    onChange({ ...formData, [field]: value });
  };

  const toggleAccordion = (id) => {
    setActiveAccordion(activeAccordion === id ? null : id);
  };

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-xl p-6 shadow-lg border border-neutral-200 dark:border-neutral-700">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-neutral-200 dark:border-neutral-700">
        <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-500/20 flex items-center justify-center">
          <svg className="w-5 h-5 text-primary-600 dark:text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-heading font-semibold text-secondary-800 dark:text-white" style={{ margin: 0 }}>
          Dental History
        </h3>
      </div>

      <div className="space-y-4">
        {/* Dentist Visits Section */}
        <AccordionSection
          id="visits"
          title="Dentist Visits"
          icon="🦷"
          isOpen={activeAccordion === 'visits'}
          onToggle={toggleAccordion}
        >
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-secondary-700 dark:text-primary-500 mb-2">
                Have you visited a dentist? *
              </label>
              <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="seenByDentist"
                    value="true"
                    checked={formData.seenByDentist === true}
                    onChange={(e) => handleInputChange('seenByDentist', true)}
                    className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-700 dark:text-neutral-300">Yes</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="seenByDentist"
                    value="false"
                    checked={formData.seenByDentist === false}
                    onChange={(e) => handleInputChange('seenByDentist', false)}
                    className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                  />
                  <span className="text-sm text-secondary-700 dark:text-neutral-300">No</span>
                </label>
              </div>
            </div>
            
            <Select
              label="When was your last dental cleaning? *"
              required
              options={[
                { value: '0-6', label: '0 to 6 months ago' },
                { value: '7-12', label: '7 to 11 months ago' },
                { value: '12-24', label: '1 year or more' }
              ]}
              value={formData.lastDentalCleaning || ''}
              onChange={(e) => handleInputChange('lastDentalCleaning', e.target.value)}
            />

            {formData.seenByDentist === true && (
              <Input
                label="Purpose of Last Visit"
                placeholder="e.g., Regular checkup, Tooth extraction, Cleaning"
                value={formData.purpose || ''}
                onChange={(e) => handleInputChange('purpose', e.target.value)}
              />
            )}
          </div>
        </AccordionSection>

        {/* Intraoral Appliances Section */}
        <AccordionSection
          id="appliances"
          title="Intraoral Appliances"
          icon="🔧"
          isOpen={activeAccordion === 'appliances'}
          onToggle={toggleAccordion}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-6">
              <p className="text-sm text-secondary-700 dark:text-neutral-300 mr-4">Do you use any intra-oral appliances?</p>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="hasOralAppliances"
                  checked={formData.hasOralAppliances === true}
                  onChange={() => onChange({
                    ...formData,
                    hasOralAppliances: true,
                    oralAppliances: formData.oralAppliances?.length
                      ? formData.oralAppliances
                      : [{ tagId: '', status: '', dateIssued: '', arch: 'None' }]
                  })}
                  className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700 dark:text-neutral-300">Yes</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="hasOralAppliances"
                  checked={formData.hasOralAppliances === false}
                  onChange={() => onChange({ ...formData, hasOralAppliances: false, oralAppliances: [] })}
                  className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-secondary-700 dark:text-neutral-300">No</span>
              </label>
            </div>

            {formData.hasOralAppliances === true && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {catalogs.oralAppliances.length > 0 ? (
                  <Select
                    label="Appliance Type *"
                    required
                    options={catalogs.oralAppliances.map(a => ({ value: a.id, label: a.name }))}
                    value={formData.oralAppliances?.[0]?.tagId || ''}
                    onChange={(e) => {
                      const entry = { ...(formData.oralAppliances?.[0] || {}), tagId: e.target.value };
                      handleInputChange('oralAppliances', [entry]);
                    }}
                  />
                ) : (
                  <Input
                    label="Appliance Type *"
                    required
                    placeholder="e.g., Braces, Retainer"
                    value={formData.oralAppliances?.[0]?.tagId || ''}
                    onChange={(e) => {
                      const entry = { ...(formData.oralAppliances?.[0] || {}), tagId: e.target.value };
                      handleInputChange('oralAppliances', [entry]);
                    }}
                  />
                )}
                <Select
                  label="Location *"
                  required
                  options={[
                    { value: 'None', label: 'None' },
                    { value: 'Upper', label: 'Upper' },
                    { value: 'Lower', label: 'Lower' },
                    { value: 'Both', label: 'Both' }
                  ]}
                  value={formData.oralAppliances?.[0]?.arch || 'None'}
                  onChange={(e) => {
                    const entry = { ...(formData.oralAppliances?.[0] || {}), arch: e.target.value };
                    handleInputChange('oralAppliances', [entry]);
                  }}
                />
                <Input
                  label="Status *"
                  required
                  placeholder="e.g., Active, Completed"
                  value={formData.oralAppliances?.[0]?.status || ''}
                  onChange={(e) => {
                    const entry = { ...(formData.oralAppliances?.[0] || {}), status: e.target.value };
                    handleInputChange('oralAppliances', [entry]);
                  }}
                />
                <Input
                  label="Date Issued *"
                  type="date"
                  required
                  value={formData.oralAppliances?.[0]?.dateIssued || ''}
                  onChange={(e) => {
                    const entry = { ...(formData.oralAppliances?.[0] || {}), dateIssued: e.target.value };
                    handleInputChange('oralAppliances', [entry]);
                  }}
                />
              </div>
            )}
          </div>
        </AccordionSection>

        {/* Dental Procedures Section */}
        <AccordionSection
          id="procedures"
          title="Dental Procedures"
          icon="🔬"
          isOpen={activeAccordion === 'procedures'}
          onToggle={toggleAccordion}
        >
          <div className="space-y-4">
            <p className="text-sm text-secondary-600 dark:text-neutral-400 mb-2">
              Have you had any of the following dental procedures within the past 24 months (2 years)?
            </p>

            <div className="space-y-3">
              {catalogs.dentalProcedures.map((procedure) => {
                const isSelected = (formData.dentalProcedures || []).some(p => p.procedureTypeId === procedure.id);
                return (
                  <div key={procedure.id} className="bg-neutral-50 dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-secondary-700 dark:text-neutral-300">{procedure.name}</span>
                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`procedure-${procedure.id}`}
                            checked={isSelected}
                            onChange={() => {
                              const procedures = formData.dentalProcedures || [];
                              if (!isSelected) {
                                handleInputChange('dentalProcedures', [...procedures, { procedureTypeId: procedure.id, procedureDate: '' }]);
                              }
                            }}
                            className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                          />
                          <span className="text-sm text-secondary-600 dark:text-neutral-400">Yes</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name={`procedure-${procedure.id}`}
                            checked={!isSelected}
                            onChange={() => {
                              const procedures = (formData.dentalProcedures || []).filter(p => p.procedureTypeId !== procedure.id);
                              handleInputChange('dentalProcedures', procedures);
                            }}
                            className="w-4 h-4 text-primary-500 focus:ring-primary-500"
                          />
                          <span className="text-sm text-secondary-600 dark:text-neutral-400">No</span>
                        </label>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-600">
                        <Input
                          label="Date of Procedure *"
                          type="date"
                          required
                          value={(formData.dentalProcedures || []).find(p => p.procedureTypeId === procedure.id)?.procedureDate || ''}
                          onChange={(e) => {
                            const procedures = (formData.dentalProcedures || []).map(p =>
                              p.procedureTypeId === procedure.id ? { ...p, procedureDate: e.target.value } : p
                            );
                            handleInputChange('dentalProcedures', procedures);
                          }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </AccordionSection>

        {/* Dental Photos Section */}
        <AccordionSection
          id="photos"
          title="Dental Photos"
          icon="📸"
          isOpen={activeAccordion === 'photos'}
          onToggle={toggleAccordion}
        >
          <div className="space-y-4">
            <p className="text-sm text-secondary-600 dark:text-neutral-400">Upload photos of your upper and lower teeth.</p>

            {/* Upper Teeth Photo */}
            <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-5">
              <label className="block text-sm font-medium text-secondary-700 dark:text-primary-500 mb-2">
                Upload Photo of Upper Teeth *
              </label>
              {formData.upperTeethPhoto?.preview && (
                <div className="mb-3">
                  <img src={formData.upperTeethPhoto.preview} alt="Upper teeth preview" className="max-w-xs rounded-lg border border-neutral-200" />
                </div>
              )}
              <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-primary-600 text-primary-600 rounded-md hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors text-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                {formData.upperTeethPhoto ? 'Change file' : 'Add file'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => handleInputChange('upperTeethPhoto', { file, preview: reader.result, name: file.name });
                    reader.readAsDataURL(file);
                  }
                }} />
              </label>
              {formData.upperTeethPhoto?.name && (
                <p className="text-xs text-secondary-500 mt-2">{formData.upperTeethPhoto.name}</p>
              )}
            </div>

            {/* Lower Teeth Photo */}
            <div className="border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg p-5">
              <label className="block text-sm font-medium text-secondary-700 dark:text-primary-500 mb-2">
                Upload Photo of Lower Teeth *
              </label>
              {formData.lowerTeethPhoto?.preview && (
                <div className="mb-3">
                  <img src={formData.lowerTeethPhoto.preview} alt="Lower teeth preview" className="max-w-xs rounded-lg border border-neutral-200" />
                </div>
              )}
              <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-primary-600 text-primary-600 rounded-md hover:bg-primary-50 dark:hover:bg-primary-500/10 transition-colors text-sm">
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                {formData.lowerTeethPhoto ? 'Change file' : 'Add file'}
                <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onloadend = () => handleInputChange('lowerTeethPhoto', { file, preview: reader.result, name: file.name });
                    reader.readAsDataURL(file);
                  }
                }} />
              </label>
              {formData.lowerTeethPhoto?.name && (
                <p className="text-xs text-secondary-500 mt-2">{formData.lowerTeethPhoto.name}</p>
              )}
            </div>
          </div>
        </AccordionSection>


      </div>
    </div>
  );
};

export default DentalHistoryStep;
