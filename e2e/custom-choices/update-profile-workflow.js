'use strict';

async function fillUpdateProfileFields(page, role, options = {}) {
  if (role === 'Student') {
    const program = page.getByPlaceholder('Type to search for your program...');
    await program.fill(options.programSearch || 'Computer');
    await program.locator('..').getByRole('button').first().click();
    await page.getByLabel('Student Category').selectOption('Freshman');
    return;
  }

  await page.getByLabel('Department').fill(options.department || 'Facilities');
  await page.getByLabel('Employment Category').selectOption('Non-Teaching');
  await page.getByLabel('Position').fill('Consultant');
}

module.exports = { fillUpdateProfileFields };
