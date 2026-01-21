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
    <div className="form-section">
      <h3 className="text-xl font-heading font-semibold text-secondary-900 mb-6 flex items-center">
        <svg className="w-6 h-6 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Dental History
      </h3>

      <div className="space-y-6">
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
                value="Yes"
                checked={data.firstTimeDentist === 'Yes'}
                onChange={(e) => handleChange('firstTimeDentist', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="firstTimeDentist"
                value="No"
                checked={data.firstTimeDentist === 'No'}
                onChange={(e) => handleChange('firstTimeDentist', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">No</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="firstTimeDentist"
                value="I don't know"
                checked={data.firstTimeDentist === "I don't know"}
                onChange={(e) => handleChange('firstTimeDentist', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">I don't know</span>
            </label>
          </div>
        </div>

        {/* Last Dental Consultation */}
        {data.firstTimeDentist === 'No' && (
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
              <input
                type="radio"
                name="lastDentalCleaning"
                value="0 to 6 months ago"
                checked={data.lastDentalCleaning === '0 to 6 months ago'}
                onChange={(e) => handleChange('lastDentalCleaning', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">0 to 6 months ago</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="lastDentalCleaning"
                value="7 to 11 months ago"
                checked={data.lastDentalCleaning === '7 to 11 months ago'}
                onChange={(e) => handleChange('lastDentalCleaning', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">7 to 11 months ago</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="lastDentalCleaning"
                value="1 year or more"
                checked={data.lastDentalCleaning === '1 year or more'}
                onChange={(e) => handleChange('lastDentalCleaning', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">1 year or more</span>
            </label>
          </div>
        </div>

        {/* Intra-Oral Appliance */}
        <div>
          <label className="form-label">
            ARE YOU WEARING ANY INTRA-ORAL APPLIANCE (e.g. braces, dentures, etc.) <span className="text-error-500">*</span>
          </label>
          <div className="flex gap-6 mt-2 ml-6">
            <label className="flex items-center">
              <input
                type="radio"
                name="hasIntraOralAppliance"
                value="Yes"
                checked={data.hasIntraOralAppliance === 'Yes'}
                onChange={(e) => handleChange('hasIntraOralAppliance', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="hasIntraOralAppliance"
                value="No"
                checked={data.hasIntraOralAppliance === 'No'}
                onChange={(e) => handleChange('hasIntraOralAppliance', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">No</span>
            </label>
          </div>
        </div>

        {/* Appliance Types */}
        {data.hasIntraOralAppliance === 'Yes' && (
          <div>
            <label className="form-label mb-3">IF YES, KINDLY CHECK BELOW</label>
            <div className="space-y-2 ml-6">
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
              <Checkbox
                label="Dentures"
                checked={data.intraOralAppliances?.dentures || false}
                onChange={(e) => handleApplianceChange('dentures', e.target.checked)}
              />
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

            {/* Appliance Location */}
            <div className="mt-6">
              <label className="form-label mb-3">SPECIFY THE LOCATION OF YOUR INTRA-ORAL APPLIANCE</label>
              <div className="space-y-2 ml-6">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="applianceLocation"
                    value="Upper only"
                    checked={data.applianceLocation === 'Upper only'}
                    onChange={(e) => handleChange('applianceLocation', e.target.value)}
                    className="form-checkbox"
                  />
                  <span className="ml-2 text-secondary-700">Upper only</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="applianceLocation"
                    value="Lower only"
                    checked={data.applianceLocation === 'Lower only'}
                    onChange={(e) => handleChange('applianceLocation', e.target.value)}
                    className="form-checkbox"
                  />
                  <span className="ml-2 text-secondary-700">Lower only</span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="applianceLocation"
                    value="Both Upper and Lower"
                    checked={data.applianceLocation === 'Both Upper and Lower'}
                    onChange={(e) => handleChange('applianceLocation', e.target.value)}
                    className="form-checkbox"
                  />
                  <span className="ml-2 text-secondary-700">Both Upper and Lower</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tooth Extraction */}
        <div>
          <label className="form-label">
            HAVE YOU HAD TOOTH EXTRACTION FOR THE PAST 24 MONTHS (2 YEARS ) OR MORE ? <span className="text-error-500">*</span>
          </label>
          <div className="flex gap-6 mt-2 ml-6">
            <label className="flex items-center">
              <input
                type="radio"
                name="toothExtraction"
                value="Yes"
                checked={data.toothExtraction === 'Yes'}
                onChange={(e) => handleChange('toothExtraction', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="toothExtraction"
                value="No"
                checked={data.toothExtraction === 'No'}
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
                value="Yes"
                checked={data.dentalFilling === 'Yes'}
                onChange={(e) => handleChange('dentalFilling', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">Yes</span>
            </label>
            <label className="flex items-center">
              <input
                type="radio"
                name="dentalFilling"
                value="No"
                checked={data.dentalFilling === 'No'}
                onChange={(e) => handleChange('dentalFilling', e.target.value)}
                className="form-checkbox"
              />
              <span className="ml-2 text-secondary-700">No</span>
            </label>
          </div>
        </div>

        {/* Upload Upper Teeth Photo */}
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
  );
};

export default DentalHistoryForm;
