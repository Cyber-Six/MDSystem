const {
  DATA_CONSENT_REQUIRED,
  OUTDATED_CONSENT,
  getConsentGateError,
} = require('../consent.js');

function normalizeBoolLike(value) {
  if (typeof value === 'boolean') {
    return value;
  }

  return String(value || '').trim().toLowerCase() === 'true';
}

function normalizeVersionLike(value) {
  return String(value || '').trim();
}

describe('consent gate decision matrix', () => {
  test('requires consent when consent flag is missing/false-like', () => {
    const falseLikeInputs = [false, 'false', 'FALSE', '', null, undefined, 0];

    for (const input of falseLikeInputs) {
      expect(
        getConsentGateError({ data_consent: input, data_consent_version: 'v1.0' }, 'v1.0')
      ).toBe(DATA_CONSENT_REQUIRED);
    }
  });

  test('allows login/register when consent=true and required version is empty', () => {
    const trueLikeInputs = [true, 'true', 'TRUE', ' TrUe '];
    const emptyRequiredVersions = ['', null, undefined, '   '];

    for (const consentValue of trueLikeInputs) {
      for (const requiredVersion of emptyRequiredVersions) {
        expect(
          getConsentGateError(
            { data_consent: consentValue, data_consent_version: 'v1.0' },
            requiredVersion
          )
        ).toBeNull();
      }
    }
  });

  test('requires renewal when consent=true but version mismatches', () => {
    expect(
      getConsentGateError({ data_consent: true, data_consent_version: 'v1.0' }, 'v2.0')
    ).toBe(OUTDATED_CONSENT);

    expect(
      getConsentGateError({ data_consent: 'TRUE', data_consent_version: '  v1.0 ' }, 'v2.0')
    ).toBe(OUTDATED_CONSENT);
  });

  test('accepts when consent=true and versions match after normalization', () => {
    expect(
      getConsentGateError({ data_consent: true, data_consent_version: 'v1.0' }, 'v1.0')
    ).toBeNull();

    expect(
      getConsentGateError({ data_consent: 'TRUE', data_consent_version: '  v1.0 ' }, ' v1.0 ')
    ).toBeNull();
  });

  test('covers all consent/version permutations', () => {
    const consentInputs = [true, false, 'true', 'false', 'TRUE', 'FALSE', '', null, undefined, 1, 0];
    const sessionVersions = ['v1.0', 'v2.0', '', null, undefined, ' v1.0 ', 'v1.0-beta'];
    const requiredVersions = ['v1.0', 'v2.0', '', null, undefined, ' v1.0 ', 'v1.0-beta'];

    for (const data_consent of consentInputs) {
      for (const data_consent_version of sessionVersions) {
        for (const requiredVersion of requiredVersions) {
          const hasConsent = normalizeBoolLike(data_consent);
          const normalizedRequiredVersion = normalizeVersionLike(requiredVersion);
          const normalizedSessionVersion = normalizeVersionLike(data_consent_version);

          let expected;
          if (!hasConsent) {
            expected = DATA_CONSENT_REQUIRED;
          } else if (!normalizedRequiredVersion) {
            expected = null;
          } else if (normalizedSessionVersion !== normalizedRequiredVersion) {
            expected = OUTDATED_CONSENT;
          } else {
            expected = null;
          }

          expect(
            getConsentGateError({ data_consent, data_consent_version }, requiredVersion)
          ).toBe(expected);
        }
      }
    }
  });
});
