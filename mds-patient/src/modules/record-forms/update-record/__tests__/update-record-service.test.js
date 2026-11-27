import { axiosRequest } from '../../../../packages-core-adapter';
import { createImmunizationProfile, mapRevisionDataToFormData } from '../update-record-service';

jest.mock('../../../../packages-core-adapter', () => ({ axiosRequest: jest.fn() }));

it.each(['Follow up in June\nBring vaccine card', null])('round-trips vaccine details without retired profile notes (%s)', async notes => {
  const immunizations = [{ vaccineTypeId: 8, doseNumber: 2, immunizationDate: '2025-01-02' }];
  const form = await mapRevisionDataToFormData({ immunizationProfile: { immunizations, notes } });
  expect(form).not.toHaveProperty('immunizationNotes');
  axiosRequest.mockResolvedValue({ data: { data: { createImmunizationProfile: { id: 12 } } } });
  await createImmunizationProfile(form);
  expect(axiosRequest.mock.lastCall[0].data.variables.input).toEqual({ immunizations });
});

it('restores saved negative dental answers during revision', async () => {
  const form = await mapRevisionDataToFormData({
    dentalProcedureProfile: { procedures: [] },
    oralApplianceProfile: { appliances: [] },
  });
  expect(form).toMatchObject({ hasDentalProcedures: false, hasOralAppliances: false });
});
