const { test, expect } = require('@playwright/test');
const { openRecord } = require('../workflow');
const { fixture } = require('../fixtures');

for (const kind of ['initial', 'update']) for (const status of ['Pending', 'RevisionSubmitted', 'Approved', 'Rejected']) {
  test(`${kind} ${status}: sidebar navigation opens only the assigned ticket after pagination`, async ({ page }) => {
    test.setTimeout(10_000);
    page.setDefaultTimeout(2_000);
    const manifest = fixture('Student', kind), url = 'https://staff.qa.invalid';
    const paths = [];
    await page.route(`${url}/**`, async route => {
      const pathname = new URL(route.request().url()).pathname;
      paths.push(pathname);
      const nav = '<nav><a href="/pending" title="Pending Requests"><span aria-hidden="true">icon</span></a></nav>';
      if (pathname === '/') return route.fulfill({ contentType: 'text/html', body: nav });
      if (pathname !== '/pending') return route.fulfill({ status: 404, body: 'Wrong route' });
      return route.fulfill({ contentType: 'text/html', body: `${nav}
        <select id="kind"><option value="all">All Types</option><option value="Initial Record">Initial Record</option><option value="Record Update">Record Update</option></select>
        <select id="status"><option value="all">All Status</option><option value="Revision">Revision Requested</option>${['Pending', 'RevisionSubmitted', 'Approved', 'Rejected'].map(value => `<option value="${value}">${value}</option>`).join('')}</select>
        <select id="branch" ${kind === 'update' ? 'disabled' : ''}><option value="Manila">Manila</option></select>
        <table><tbody id="rows"><tr><td>#other-ticket</td></tr></tbody></table>
        <button aria-label="Next page" onclick="showAssigned()">Next</button>
        <button id="review" hidden onclick="window.reviewed=window.selected">Review Full Record</button>
        <script>
          function showAssigned(){
            const row=document.createElement('tr'), cell=document.createElement('td');
            cell.textContent='#${manifest.ticketId}'; row.append(cell);
            row.onclick=()=>{window.selected='${manifest.ticketId}';document.querySelector('#review').hidden=false;};
            document.querySelector('#rows').replaceChildren(row);
            document.querySelector('[aria-label="Next page"]').disabled=true;
          }
        </script>` });
    });
    await openRecord({ page, url }, manifest, kind, status);
    expect(paths).toEqual(['/', '/pending']);
    await expect(page.locator('#kind')).toHaveValue(kind === 'initial' ? 'Initial Record' : 'Record Update');
    await expect(page.locator('#status')).toHaveValue(status);
    expect(await page.evaluate(() => window.reviewed)).toBe(manifest.ticketId);
  });
}
