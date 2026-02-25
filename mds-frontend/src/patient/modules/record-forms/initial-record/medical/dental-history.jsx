import React from 'react';
import { Input, Textarea, Checkbox } from './form-elements';

const DentalHistoryForm = ({ data, onChange }) => {
  const handleChange = (field, value) => {
    onChange({ ...data, [field]: value });
  };

  const handleApplianceChange = (appliance, checked) => {
    onChange({
      ...data,
      intraOralAppliances: {
        ...data.intraOralAppliances,
        [appliance]: checked
      }
    });
  };

  const handleFileChange = (field, event) => {
    const file = event.target.files[0];
    if (file) {
      // Create a preview URL for the image
      const reader = new FileReader();
      reader.onloadend = () => {
        handleChange(field, {
          file: file,
          preview: reader.result,
          name: file.name
        });
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Dental Visit History Card ── */}
      <div className="form-section">
        <h3 className="text-lg font-heading font-semibold text-secondary-900 mb-5 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-100 text-blue-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </span>
          Dental Visit History
        </h3>

        <div className="space-y-5">
          {/* First Time to See Dentist */}
          <div>
            <label className="form-label">
              IS THIS YOUR FIRST TIME TO BE SEEN BY A DENTIST ? <span className="text-error-500">*</span>
            </label>
            <div className="flex gap-6 mt-2 ml-6">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="firstTimeDentist"
                  value="yes"
                  checked={data.firstTimeDentist === 'yes'}
                  onChange={(e) => handleChange('firstTimeDentist', e.target.value)}
                  className="form-checkbox"
                />
                <span className="ml-2 text-secondary-700">Yes</span>
              </label>
              <label className="flex items-center">
                <input
                  type="radio"
                  name="firstTimeDentist"
                  value="no"
                  checked={data.firstTimeDentist === 'no'}
                  onChange={(e) => handleChange('firstTimeDentist', e.target.value)}
                  className="form-checkbox"
                />
                <span className="ml-2 text-secondary-700">No</span>
              </label>
            </div>
          </div>

          {/* Last Dental Consultation */}
          {data.firstTimeDentist === 'no' && (
            <div>
              <label className="form-label">IF "NO"... WHEN WAS YOUR LAST DENTAL CONSULTATION ?</label>
              <p className="text-xs text-secondary-500 mb-2">Indicate Month and Year</p>
              <Input
                placeholder="Your answer"
                value={data.lastDentalConsultation || ''}
                onChange={(e) => handleChange('lastDentalConsultation', e.target.value)}
              />
            </div>
          )}

          {/* Last Dental Cleaning */}
          <div>
            <label className="form-label">
              WHEN WAS YOUR LAST DENTAL CLEANING? <span className="text-error-500">*</span>
            </label>
            <div className="space-y-2 mt-2 ml-6">
              <label className="flex items-center">
                <input type="radio" name="lastDentalCleaning" value="0 to 6 months ago" checked={data.lastDentalCleaning === '0 to 6 months ago'} onChange={(e) => handleChange('lastDentalCleaning', e.target.value)} className="form-checkbox" />
                <span className="ml-2 text-secondary-700">0 to 6 months ago</span>
              </label>
              <label className="flex items-center">
                <input type="radio" name="lastDentalCleaning" value="7 to 11 months ago" checked={data.lastDentalCleaning === '7 to 11 months ago'} onChange={(e) => handleChange('lastDentalCleaning', e.target.value)} className="form-checkbox" />
                <span className="ml-2 text-secondary-700">7 to 11 months ago</span>
              </label>
              <label className="flex items-center">
                <input type="radio" name="lastDentalCleaning" value="1 year or more" checked={data.lastDentalCleaning === '1 year or more'} onChange={(e) => handleChange('lastDentalCleaning', e.target.value)} className="form-checkbox" />
                <span className="ml-2 text-secondary-700">1 year or more</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {/* ── Intra-Oral Appliances Card ── */}
      <div className="form-section">
        <h3 className="text-lg font-heading font-semibold text-secondary-900 mb-5 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-purple-100 text-purple-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
            </svg>
          </span>
          Intra-Oral Appliances
        </h3>

        <div className="space-y-5">
          <div>
            <label className="form-label">
              ARE YOU WEARING ANY INTRA-ORAL APPLIANCE (e.g. braces, dentures, etc.) <span className="text-error-500">*</span>
            </label>
            <div className="flex gap-6 mt-2 ml-6">
              <label className="flex items-center">
                <input type="radio" name="hasIntraOralAppliance" value="yes" checked={data.hasIntraOralAppliance === 'yes'} onChange={(e) => handleChange('hasIntraOralAppliance', e.target.value)} className="form-checkbox" />
                <span className="ml-2 text-secondary-700">Yes</span>
              </label>
              <label className="flex items-center">
                <input type="radio" name="hasIntraOralAppliance" value="no" checked={data.hasIntraOralAppliance === 'no'} onChange={(e) => handleChange('hasIntraOralAppliance', e.target.value)} className="form-checkbox" />
                <span className="ml-2 text-secondary-700">No</span>
              </label>
            </div>
          </div>

        {/* Appliance Types */}
        {data.hasIntraOralAppliance === 'yes' && (
          <div>
            <label className="form-label mb-3">IF YES, KINDLY CHECK BELOW</label>
            <div className="space-y-3 ml-6">
              <Checkbox
                label="Dental Brace (Orthodontic appliance)"
                checked={data.intraOralAppliances?.dentalBrace || false}
                onChange={(e) => handleApplianceChange('dentalBrace', e.target.checked)}
              />
              <Checkbox
                label="Dental Bridge/s, Jacket Crown/s"
                checked={data.intraOralAppliances?.dentalBridge || false}
                onChange={(e) => handleApplianceChange('dentalBridge', e.target.checked)}
              />
              
              {/* Dentures with inline location selection */}
              <div className="flex flex-col gap-2">
                <Checkbox
                  label="Dentures"
                  checked={data.intraOralAppliances?.dentures || false}
                  onChange={(e) => handleApplianceChange('dentures', e.target.checked)}
                />
                {data.intraOralAppliances?.dentures && (
                  <div className="ml-6 flex gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="dentureLocation"
                        value="Upper"
                        checked={data.dentureLocation === 'Upper'}
                        onChange={(e) => handleChange('dentureLocation', e.target.value)}
                        className="form-checkbox"
                      />
                      <span className="ml-2 text-secondary-700">Upper</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="dentureLocation"
                        value="Lower"
                        checked={data.dentureLocation === 'Lower'}
                        onChange={(e) => handleChange('dentureLocation', e.target.value)}
                        className="form-checkbox"
                      />
                      <span className="ml-2 text-secondary-700">Lower</span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="dentureLocation"
                        value="Both"
                        checked={data.dentureLocation === 'Both'}
                        onChange={(e) => handleChange('dentureLocation', e.target.value)}
                        className="form-checkbox"
                      />
                      <span className="ml-2 text-secondary-700">Both</span>
                    </label>
                  </div>
                )}
              </div>
              
              <Checkbox
                label="Bite planes, Expander, Night guards"
                checked={data.intraOralAppliances?.bitePlanes || false}
                onChange={(e) => handleApplianceChange('bitePlanes', e.target.checked)}
              />
              <Checkbox
                label="Retainers"
                checked={data.intraOralAppliances?.retainers || false}
                onChange={(e) => handleApplianceChange('retainers', e.target.checked)}
              />
              <div className="flex items-center gap-2">
                <Checkbox
                  label="Other:"
                  checked={data.intraOralAppliances?.other || false}
                  onChange={(e) => handleApplianceChange('other', e.target.checked)}
                />
                {data.intraOralAppliances?.other && (
                  <Input
                    placeholder="Specify other appliance..."
                    value={data.applianceOther || ''}
                    onChange={(e) => handleChange('applianceOther', e.target.value)}
                    className="flex-1"
                  />
                )}
              </div>
            </div>

            {/* Appliance Location - for non-denture appliances */}
            <div className="mt-6">
              <label className="form-label mb-3">SPECIFY THE LOCATION OF YOUR INTRA-ORAL APPLIANCE (except dentures)</label>
              <div className="flex gap-6 ml-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="applianceLocation"
                    value="Upper"
                    checked={data.applianceLocation === 'Upper'}
                    onChange={(e) => handleChange('applianceLocation', e.target.value)}
                    className="form-checkbox"
                  />
                  <span className="ml-2 text-secondary-700">Upper</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="applianceLocation"
                    value="Lower"
                    checked={data.applianceLocation === 'Lower'}
                    onChange={(e) => handleChange('applianceLocation', e.target.value)}
                    className="form-checkbox"
                  />
                  <span className="ml-2 text-secondary-700">Lower</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="applianceLocation"
                    value="Both"
                    checked={data.applianceLocation === 'Both'}
                    onChange={(e) => handleChange('applianceLocation', e.target.value)}
                    className="form-checkbox"
                  />
                  <span className="ml-2 text-secondary-700">Both</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tooth Extraction */}
        </div>
      </div>

      {/* ── Dental Procedures Card ── */}
      <div className="form-section">
        <h3 className="text-lg font-heading font-semibold text-secondary-900 mb-5 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-amber-100 text-amber-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
            </svg>
          </span>
          Dental Procedures
        </h3>

        <div className="space-y-5">
        <div>
          <label className="form-label">
            HAVE YOU HAD TOOTH EXTRACTION FOR THE PAST 24 MONTHS (2 YEARS ) OR MORE ? <span className="text-error-500">*</span>
          </label>
          <div className="flex gap-6 mt-2 ml-6">
            <label className="flex items-center">
              <input
                type="radio"
                name="toothExtraction"
                value="yes"
                checked={data.toothExtraction === 'yes'}
                onChange={(e) => handleChange('toothExtraction', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="toothExtraction"
                value="no"
                checked={data.toothExtraction === 'no'}
                onChange={(e) => handleChange('toothExtraction', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">No</span>
            </label>
          </div>
        </div>

        {/* Dental Filling */}
        <div>
          <label className="form-label">
            HAVE YOU HAD A DENTAL FILLING FOR THE PAST 24 MONTHS ( 2 YEARS ) OR MORE? <span className="text-error-500">*</span>
          </label>
          <div className="flex gap-6 mt-2 ml-6">
            <label className="flex items-center">
              <input
                type="radio"
                name="dentalFilling"
                value="yes"
                checked={data.dentalFilling === 'yes'}
                onChange={(e) => handleChange('dentalFilling', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="dentalFilling"
                value="no"
                checked={data.dentalFilling === 'no'}
                onChange={(e) => handleChange('dentalFilling', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">No</span>
            </label>
          </div>
        </div>

        </div>
      </div>

      {/* ── Dental Photos Card ── */}
      <div className="form-section">
        <h3 className="text-lg font-heading font-semibold text-secondary-900 mb-5 flex items-center gap-2">
          <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-green-100 text-green-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </span>
          Dental Photos
        </h3>

        <div className="space-y-5">
        <div className="border-2 border-dashed border-secondary-300 rounded-lg p-6">
          <label className="form-label">
            UPLOAD PHOTO OF UPPER TEETH <span className="text-error-500">*</span>
          </label>
          <p className="text-xs text-secondary-600 mb-4">Please upload your DENTAL PHOTOS AS SEEN IN THE PHOTO</p>
          
          {data.upperTeethPhoto?.preview && (
            <div className="mb-4">
              <img 
                src={data.upperTeethPhoto.preview} 
                alt="Upper teeth preview" 
                className="max-w-md rounded-lg border border-secondary-200"
              />
              <p className="text-xs text-secondary-500 mt-2">UPPER PHOTO SAMPLE</p>
              <p className="text-xs text-secondary-500">Upload 1 supported file. Max 10 MB.</p>
            </div>
          )}
          
          <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-primary-600 text-primary-600 rounded-md hover:bg-primary-50 transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Add file
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange('upperTeethPhoto', e)}
              className="hidden"
            />
          </label>
          {data.upperTeethPhoto?.name && (
            <p className="text-sm text-secondary-700 mt-2">{data.upperTeethPhoto.name}</p>
          )}
        </div>

        {/* Upload Lower Teeth Photo */}
        <div className="border-2 border-dashed border-secondary-300 rounded-lg p-6">
          <label className="form-label">
            UPLOAD PHOTO OF LOWER TEETH <span className="text-error-500">*</span>
          </label>
          <p className="text-xs text-secondary-600 mb-4">Please upload your DENTAL PHOTOS AS SEEN IN THE PHOTO</p>
          
          {data.lowerTeethPhoto?.preview && (
            <div className="mb-4">
              <img 
                src={data.lowerTeethPhoto.preview} 
                alt="Lower teeth preview" 
                className="max-w-md rounded-lg border border-secondary-200"
              />
              <p className="text-xs text-secondary-500 mt-2">LOWER PHOTO SAMPLE</p>
              <p className="text-xs text-secondary-500">Upload 1 supported file. Max 10 MB.</p>
            </div>
          )}
          
          <label className="cursor-pointer inline-flex items-center px-4 py-2 border border-primary-600 text-primary-600 rounded-md hover:bg-primary-50 transition-colors">
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Add file
            <input
              type="file"
              accept="image/*"
              onChange={(e) => handleFileChange('lowerTeethPhoto', e)}
              className="hidden"
            />
          </label>
          {data.lowerTeethPhoto?.name && (
            <p className="text-sm text-secondary-700 mt-2">{data.lowerTeethPhoto.name}</p>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default DentalHistoryForm;
