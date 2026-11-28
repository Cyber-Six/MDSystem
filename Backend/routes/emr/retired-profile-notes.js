// Installed mobile clients still select these fields. They are compatibility
// placeholders only; neither profile has a notes storage requirement.
module.exports = {
  MedicalHistory: { notes: () => null },
  ImmunizationProfile: { notes: () => null },
};
