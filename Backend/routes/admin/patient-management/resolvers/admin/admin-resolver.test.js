jest.mock('../../../../../config/db', () => ({ query: jest.fn() }));
const db = require('../../../../../config/db');
const resolver = require('./admin-resolver');
beforeEach(() => jest.clearAllMocks());

test('lists patients, finds by id, groups superior patients and subordinates', async () => {
  const rows = [{ id: 4 }, { id: 2 }];
  db.query.mockResolvedValue({ rows });
  await expect(resolver.Query.getPatients()).resolves.toEqual(rows);
  await expect(resolver.Query.getPatient(null, { id: 4 })).resolves.toEqual(rows[0]);
  await expect(resolver.Query.getSuperiorPatients()).resolves.toEqual(rows);
  await expect(resolver.Query.getSubordinates(null, { superior_patient_id: 4 })).resolves.toEqual(rows);
  await expect(resolver.Query.getPatient(null, { id: 99 })).resolves.toEqual(rows[0]);
  expect(db.query).toHaveBeenCalledWith(expect.stringContaining('superior_patient_id = $1'), [4]);
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(resolver.Query.getPatient(null, { id: 99 })).resolves.toBeNull();
});

test('sets and removes superior status only for an existing patient', async () => {
  db.query.mockResolvedValueOnce({ rows: [{ id: 8 }] }).mockResolvedValueOnce({ rows: [{ id: 8, superior_patient_id: null }] });
  await expect(resolver.Mutation.setPatientAsSuperior(null, { patient_id: 8 })).resolves.toEqual({ id: 8, superior_patient_id: null });
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(resolver.Mutation.setPatientAsSuperior(null, { patient_id: 8 })).rejects.toThrow('Patient not found');
  db.query.mockResolvedValueOnce({ rows: [{ id: 8 }] }).mockResolvedValueOnce({ rows: [{ id: 8, superior_patient_id: null }] });
  await expect(resolver.Mutation.removeSuperiorFromPatient(null, { patient_id: 8 })).resolves.toEqual({ id: 8, superior_patient_id: null });
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(resolver.Mutation.removeSuperiorFromPatient(null, { patient_id: 3 })).rejects.toThrow('Patient not found');
});

test('assigns a superior while rejecting self links, missing patients and circular relationships', async () => {
  await expect(resolver.Mutation.assignSuperiorToPatient(null, { patient_id: 1, superior_patient_id: 1 })).rejects.toThrow('Patient cannot be their own superior');
  db.query.mockResolvedValueOnce({ rows: [] });
  await expect(resolver.Mutation.assignSuperiorToPatient(null, { patient_id: 1, superior_patient_id: 2 })).rejects.toThrow('Patient not found');
  db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [] });
  await expect(resolver.Mutation.assignSuperiorToPatient(null, { patient_id: 1, superior_patient_id: 2 })).rejects.toThrow('Superior patient not found');
  db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 2 }] }).mockResolvedValueOnce({ rowCount: 1, rows: [{}] });
  await expect(resolver.Mutation.assignSuperiorToPatient(null, { patient_id: 1, superior_patient_id: 2 })).rejects.toThrow('circular superior relationship');
  db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }).mockResolvedValueOnce({ rows: [{ id: 2 }] }).mockResolvedValueOnce({ rowCount: 0, rows: [] }).mockResolvedValueOnce({ rows: [{ id: 1, superior_patient_id: 2 }] });
  await expect(resolver.Mutation.assignSuperiorToPatient(null, { patient_id: 1, superior_patient_id: 2 })).resolves.toEqual({ id: 1, superior_patient_id: 2 });
});

test('resolves parent relations and handles patients without a superior', async () => {
  expect(await resolver.Patient.superior({ superior_patient_id: null })).toBeNull();
  db.query.mockResolvedValueOnce({ rows: [{ id: 2 }] });
  await expect(resolver.Patient.superior({ superior_patient_id: 2 })).resolves.toEqual({ id: 2 });
  db.query.mockResolvedValueOnce({ rows: [{ id: 3 }] });
  await expect(resolver.Patient.subordinates({ id: 2 })).resolves.toEqual([{ id: 3 }]);
});
