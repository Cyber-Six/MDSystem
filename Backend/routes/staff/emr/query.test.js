jest.mock('../../../config/query.js', () => ({ query: jest.fn() }));
jest.mock('../../../utils/logger.js', () => ({ debug: jest.fn() }));
jest.mock('../../../services/authorization/permit.js', () => ({ permissions: { emr_allow_set_vital_sign: 'VITAL', emr_allow_set_dental_record: 'DENTAL', emr_allow_view: 'VIEW' }, isMedicalPermittedPatientBased: jest.fn(), isMedicalPermittedPatientBasedMulti: jest.fn() }));
jest.mock('./helper.js', () => ({ getPatientIdFromvitalSignsId: jest.fn(), getPatientIdFromDentalRecordId: jest.fn() }));

const db = require('../../../config/query.js');
const permit = require('../../../services/authorization/permit.js');
const helper = require('./helper.js');
const Query = require('./query.js');
const ctx = (user = { id: 3 }) => ({ user, res: { status: jest.fn().mockReturnThis() } });
beforeEach(() => { jest.clearAllMocks(); permit.isMedicalPermittedPatientBasedMulti.mockResolvedValue(true); helper.getPatientIdFromvitalSignsId.mockResolvedValue(7); helper.getPatientIdFromDentalRecordId.mockResolvedValue(7); });

test('all EMR reads reject anonymous callers and callers without an ID', async () => {
  const args = { patientId: 7, id: 4 };
  for (const name of Object.keys(Query)) {
    await expect(Query[name](null, args, ctx(null))).rejects.toThrow('Unauthorized');
    await expect(Query[name](null, args, ctx({}))).rejects.toThrow('Unauthorized');
  }
  expect(db.query).not.toHaveBeenCalled();
});

test('patient vital signs honor view permission and pagination defaults', async () => {
  permit.isMedicalPermittedPatientBasedMulti.mockResolvedValueOnce(false);
  await expect(Query.getPatientVitalSigns(null, { patientId: 7 }, ctx())).rejects.toThrow('Forbidden');
  db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [] });
  expect(await Query.getPatientVitalSigns(null, { patientId: 7 }, ctx())).toEqual([{ id: 1 }]);
  expect(db.query.mock.calls[0][1]).toEqual([7, 10, 0]);
  expect(permit.isMedicalPermittedPatientBasedMulti).toHaveBeenCalledWith(3, ['VITAL', 'VIEW'], 7);
  expect(await Query.getPatientVitalSigns(null, { patientId: 7, limit: 2, offset: 4 }, ctx())).toEqual([]);
  expect(db.query.mock.calls[1][1]).toEqual([7, 2, 4]);
});

test('patient dental records load tooth placements and findings for each row', async () => {
  permit.isMedicalPermittedPatientBasedMulti.mockResolvedValueOnce(false);
  await expect(Query.getPatientDentalRecord(null, { patientId: 7 }, ctx())).rejects.toThrow('Forbidden');
  db.query.mockResolvedValueOnce({ rows: [] });
  expect(await Query.getPatientDentalRecord(null, { patientId: 7 }, ctx())).toEqual([]);
  db.query.mockResolvedValueOnce({ rows: [{ id: 10 }, { id: 11 }] });
  db.query.mockResolvedValueOnce({ rows: [{ toothIndex: 1 }] }).mockResolvedValueOnce({ rows: [{ oralFindingId: 2 }] });
  db.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });
  expect(await Query.getPatientDentalRecord(null, { patientId: 7, limit: 3, offset: 1 }, ctx())).toEqual([
    { id: 10, ToothPlacements: [{ toothIndex: 1 }], oralFindings: [{ oralFindingId: 2 }] },
    { id: 11, ToothPlacements: [], oralFindings: [] }
  ]);
  expect(db.query.mock.calls[1][1]).toEqual([7, 3, 1]);
  expect(db.query.mock.calls[2][1]).toEqual([10]);
  expect(db.query.mock.calls[5][1]).toEqual([11]);
});

test('ID lookups scope permissions to the resolved patient and return records or null', async () => {
  permit.isMedicalPermittedPatientBasedMulti.mockResolvedValueOnce(false);
  await expect(Query.getVitalSignsById(null, { id: 4 }, ctx())).rejects.toThrow('Forbidden');
  db.query.mockResolvedValueOnce({ rows: [{ id: 4 }] }).mockResolvedValueOnce({ rows: [] });
  expect(await Query.getVitalSignsById(null, { id: 4 }, ctx())).toEqual({ id: 4 });
  expect(await Query.getVitalSignsById(null, { id: 5 }, ctx())).toBeNull();
  expect(permit.isMedicalPermittedPatientBasedMulti).toHaveBeenCalledWith(3, ['VITAL', 'VIEW'], 7);
  permit.isMedicalPermittedPatientBasedMulti.mockResolvedValueOnce(false);
  await expect(Query.getDentalRecordById(null, { id: 8 }, ctx())).rejects.toThrow('Forbidden');
  expect(permit.isMedicalPermittedPatientBasedMulti).toHaveBeenCalledWith(3, ['DENTAL', 'VIEW'], 7);
  db.query.mockResolvedValueOnce({ rows: [] });
  expect(await Query.getDentalRecordById(null, { id: 8 }, ctx())).toBeNull();
  db.query.mockResolvedValueOnce({ rows: [{ id: 9 }] }).mockResolvedValueOnce({ rows: [{ toothIndex: 12 }] }).mockResolvedValueOnce({ rows: [{ oralFindingId: 13 }] });
  expect(await Query.getDentalRecordById(null, { id: 9 }, ctx())).toEqual({ id: 9, ToothPlacements: [{ toothIndex: 12 }], oralFindings: [{ oralFindingId: 13 }] });
  expect(db.query.mock.calls[4][1]).toEqual([9]);
});

test('oral finding catalogs preserve explicit filters and apply pagination defaults', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [] });
  expect(await Query.getOralFindingCatalogs(null, {}, ctx())).toEqual([{ id: 1 }]);
  expect(db.query.mock.calls[0][1]).toEqual([null, 10, 0]);
  expect(await Query.getOralFindingCatalogs(null, { filterIsValid: false, offset: 5, limit: 2 }, ctx())).toEqual([]);
  expect(db.query.mock.calls[1][1]).toEqual([false, 2, 5]);
});
