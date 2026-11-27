'use strict';

const document = 'query CheckCustomChoiceSchema { getMyProfile { __typename id } }';

async function checkInitialSchema(read) {
  try {
    // A new patient legitimately has no profile. Executing this read still lets
    // PostgreSQL validate the profile query against the deployed schema.
    await read(document);
  } catch (error) {
    if (/employmentCategoryOther[\s\S]*does not exist/.test(error?.message || '')) {
      throw new Error('Deployment schema is missing employee_profile.employmentCategoryOther. Apply the employee-category ALTER TABLE statement from schemas/post_build_setup.sql to the deployed database, then retry. Registration credentials were saved locally; no custom choices or medical ticket have been submitted by this workflow.');
    }
    throw error;
  }
}

module.exports = { checkInitialSchema, document };
