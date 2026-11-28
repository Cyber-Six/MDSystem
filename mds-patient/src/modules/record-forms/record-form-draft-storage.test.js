import {
  clearPatientRecordFormDrafts,
  readRecordFormDraft,
  RECORD_FORM_DRAFT_TTL_MS,
  saveRecordFormDraft,
} from './record-form-draft-storage';

const makeStorage = () => {
  const values = new Map();
  return {
    get length() { return values.size; },
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
    key: (index) => [...values.keys()][index] ?? null,
  };
};

describe('patient record form draft cache', () => {
  it('saves and restores a draft only for the current patient session', () => {
    const localStore = makeStorage();
    const sessionStore = makeStorage();
    localStore.setItem('patient_refreshToken', 'synthetic-user:device:token');
    const data = { currentStep: 2, formData: { personalInfo: { firstName: 'Synthetic' } } };

    expect(saveRecordFormDraft('initial-student', data, { localStore, sessionStore, now: 1000 })).toBe(true);
    expect(readRecordFormDraft('initial-student', { localStore, sessionStore, now: 2000 })).toMatchObject({ data });
    localStore.setItem('patient_refreshToken', 'other-user:device:token');
    expect(readRecordFormDraft('initial-student', { localStore, sessionStore, now: 2000 })).toBeNull();
  });

  it('expires stale drafts and clears all patient drafts at sign-out', () => {
    const localStore = makeStorage();
    const sessionStore = makeStorage();
    localStore.setItem('patient_refreshToken', 'synthetic-user:device:token');
    saveRecordFormDraft('initial-student', { formData: {} }, { localStore, sessionStore, now: 1000 });
    saveRecordFormDraft('record-update', { formData: {} }, { localStore, sessionStore, now: 1000 });

    expect(readRecordFormDraft('initial-student', { localStore, sessionStore, now: 1000 + RECORD_FORM_DRAFT_TTL_MS + 1 })).toBeNull();
    clearPatientRecordFormDrafts(sessionStore);
    expect(sessionStore.length).toBe(0);
  });

  it('does not cache drafts when no authenticated patient scope is available', () => {
    expect(saveRecordFormDraft('initial-student', { formData: {} }, { localStore: makeStorage(), sessionStore: makeStorage() })).toBe(false);
  });
});
