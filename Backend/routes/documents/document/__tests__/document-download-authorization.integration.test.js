const integration = process.env.DOCUMENT_DOWNLOAD_TEST_E2E === '1' ? describe : describe.skip;

integration('issued document download authorization on the Docker E2E stack', () => {
  let browser;
  let owner;
  let otherPatient;
  let staff;
  let restrictedStaff;
  const patientUrl = process.env.E2E_PATIENT_URL;
  const staffUrl = process.env.E2E_STAFF_URL;

  beforeAll(async () => {
    const { chromium } = require('playwright');
    const { signIn } = require('../../../../../e2e/core/auth');
    browser = await chromium.launch();

    async function authenticate(url, email) {
      const page = await browser.newPage();
      try {
        return await signIn(page, url, email);
      } finally {
        await page.close();
      }
    }

    [owner, otherPatient, staff, restrictedStaff] = await Promise.all([
      authenticate(patientUrl, process.env.E2E_ALT_PATIENT_EMAIL),
      authenticate(patientUrl, process.env.E2E_PATIENT_EMAIL),
      authenticate(staffUrl, process.env.E2E_STAFF_EMAIL),
      authenticate(staffUrl, process.env.E2E_RESTRICTED_STAFF_EMAIL),
    ]);
  }, 60_000);

  afterAll(async () => {
    await browser?.close();
  });

  function request(url, session, path, options = {}) {
    return fetch(`${url}/documents/${path}`, {
      ...options,
      headers: {
        authorization: `Bearer ${session.accessToken}`,
        ...options.headers,
      },
      signal: AbortSignal.timeout(10_000),
    });
  }

  async function expectPdf(response) {
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toMatch(/^application\/pdf\b/i);
    expect(response.headers.get('content-disposition')).toMatch(/^attachment;\s*filename=/i);
    const pdf = Buffer.from(await response.arrayBuffer());
    expect(pdf.length).toBeGreaterThan(100);
    expect(pdf.toString('ascii', 0, 5)).toBe('%PDF-');
    expect(pdf.subarray(-32).toString('ascii').trimEnd()).toMatch(/%%EOF$/);
  }

  async function expectForbidden(response) {
    expect(response.status).toBe(403);
    expect(response.headers.get('content-type')).toMatch(/^application\/json\b/i);
    expect(response.headers.get('content-disposition')).toBeNull();
    expect(await response.json()).toMatchObject({ error: 'FORBIDDEN' });
  }

  test.each([
    ['prescription', {
      prescription: {
        diagnosis: 'Synthetic consultation',
        medications: [{ name: 'E2E Medicine', dosage: '100 mg' }],
      },
    }],
    ['medical-certificate', {
      certificate: {
        purpose: 'E2E certificate',
        diagnosis: 'Synthetic consultation',
        recommendations: 'Follow up as needed',
      },
    }],
  ])('%s can be downloaded by the owner and authorized staff only', async (type, data) => {
    const issued = await request(staffUrl, staff, `${type}/generate`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ patientId: owner.userId, data }),
    });
    expect(issued.status).toBe(200);
    const { documentId, success } = await issued.json();
    expect(success).toBe(true);
    expect(Number(documentId)).toBeGreaterThan(0);

    const typedDownload = `${type}/download/${documentId}`;
    const patientDownload = `my/download/${documentId}`;
    const staffDownload = `generated/download/${documentId}`;
    await expectForbidden(await request(patientUrl, otherPatient, typedDownload));
    await expectForbidden(await request(patientUrl, otherPatient, patientDownload));
    await expectPdf(await request(patientUrl, owner, typedDownload));
    await expectPdf(await request(patientUrl, owner, patientDownload));
    await expectForbidden(await request(staffUrl, restrictedStaff, typedDownload));
    await expectForbidden(await request(staffUrl, restrictedStaff, staffDownload));
    await expectPdf(await request(staffUrl, staff, typedDownload));
    await expectPdf(await request(staffUrl, staff, staffDownload));
  }, 60_000);
});
