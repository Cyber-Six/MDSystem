const { test, expect } = require('@playwright/test');
const esbuild = require('esbuild');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

let script;
let css;
test.beforeAll(async () => {
  const staffRoot = path.resolve(__dirname, '../../../mds-staff');
  const config = (await import(pathToFileURL(path.join(staffRoot, 'tailwind.config.js')).href)).default;
  const tailwind = require(require.resolve('tailwindcss', { paths: [staffRoot] }));
  const postcss = require('postcss');
  css = (await postcss([tailwind({ ...config, content: [path.join(staffRoot, 'src/**/*.{js,jsx}').replaceAll('\\', '/')] })])
    .process(fs.readFileSync(path.join(staffRoot, 'src/styles/index.css'), 'utf8') + '\n' +
      fs.readFileSync(path.join(staffRoot, 'src/modules/pending-requests/components/requests.css'), 'utf8'), { from: undefined })).css;
  const result = await esbuild.build({
    entryPoints: [path.join(__dirname, 'pending-harness.jsx')], bundle: true, write: false, format: 'iife',
    loader: { '.css': 'empty' }, define: { 'process.env.NODE_ENV': '"test"' },
    plugins: [{ name: 'synthetic-pending-services', setup(build) {
      build.onResolve({ filter: /^(?:react|react-dom)(?:\/.*)?$/ }, args => ({ path: require.resolve(args.path, { paths: [path.resolve(__dirname, '../../..')] }) }));
      build.onResolve({ filter: /(?:permissions-context|notification-context|ticket-type-helper|initial-record-service|patient-record-service|packages-core-adapter)$/ }, args => ({ path: args.path, namespace: 'pending-fixtures' }));
      build.onLoad({ filter: /.*/, namespace: 'pending-fixtures' }, args => {
        const name = args.path;
        const contents = name.includes('permissions-context')
          ? "export const usePermissions=()=>({branch:'Both',allowedBranches:()=>['Manila','QuezonCity','Both']});"
          : name.includes('notification-context')
            ? "const subscribe=()=>()=>{}; export const useStaffNotifications=()=>({subscribe});"
            : name.includes('ticket-type-helper')
              ? 'export const enrichWithInitialFlag=async rows=>rows;'
              : name.includes('initial-record-service')
                ? `export const BRANCH={MANILA:'Manila',QUEZON_CITY:'QuezonCity',BOTH:'Both'};export const ALL_BRANCHES=Object.values(BRANCH);
                  export const TICKET_STATUS={PENDING:'Pending',REVISION_SUBMITTED:'RevisionSubmitted',REVISION:'Revision',APPROVED:'Approved',REJECTED:'Rejected',EXPIRED:'Expired',CANCELLED:'Cancelled'};
                  export async function getStatusUpdateTickets(statuses,branch){window.fetches++;return window.tickets.filter(t=>statuses.includes(t.status)&&(branch==='Both'||t.branch===branch));}
                  export const staffUpdateTicket=()=>{throw Error('Unexpected mutation')};export const approveReviewedRecord=staffUpdateTicket;`
                : name.includes('patient-record-service')
                  ? 'export const fetchPatientRecordForReview=async()=>({});export const submitStaffEdits=()=>{throw Error("Unexpected mutation")};'
                  : 'export const axiosRequest={post:async()=>({data:{data:{}}})};';
        return { contents, loader: 'js' };
      });
    } }],
  });
  script = result.outputFiles[0].text;
});

async function mount(page) {
  // This harness uses synthetic data only and blocks all external traffic.
  await page.route('**/*', route => route.abort());
  await page.setContent('<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body class="bg-neutral-50 dark:bg-neutral-900"><main class="p-4 md:p-6"><div id="root"></div></main></body></html>');
  await page.addStyleTag({ content: css });
  await page.evaluate(() => {
    window.fetches = 0;
    window.tickets = Array.from({ length: 13 }, (_, index) => ({
      id: String(index + 1), patientId: String(index + 101), first_name: 'Alex', last_name: `Rivera ${index + 1}`,
      status: 'Pending', scope: 'Both', profile_type: index % 2 ? 'Employee' : 'Student', branch: 'Manila',
      created_at: new Date().toISOString(), is_initial: true,
    })).concat([
      { id: '21', patientId: '221', first_name: 'Sam', last_name: 'Cruz', status: 'RevisionSubmitted', scope: 'Dental', profile_type: 'Student', branch: 'QuezonCity', created_at: new Date().toISOString(), is_initial: false },
      { id: '22', patientId: '222', first_name: 'Ari', last_name: 'Santos', status: 'Pending', scope: 'Medical', profile_type: 'Employee', branch: 'Manila', created_at: new Date(Date.now() - 8 * 86400000).toISOString(), is_initial: false },
    ]);
  });
  await page.addScriptTag({ content: script });
  await expect(page.getByText('Alex Rivera 1', { exact: true })).toBeVisible();
}

test('queue pagination, search, branch and scope filters preserve the review entry point', async ({ page }) => {
  await mount(page);
  await page.getByRole('button', { name: 'Next page', exact: true }).click();
  await expect(page.getByText('Alex Rivera 13', { exact: true })).toBeVisible();
  await page.getByLabel('Search loaded requests').fill('#13');
  await expect(page.getByText('Showing 1–1 of 1 loaded request', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next page', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
  await expect(page.getByText('Alex Rivera 1', { exact: true })).toBeVisible();
  await page.getByLabel('Search loaded requests', { exact: true }).fill('#13');
  const review = page.getByRole('row', { name: 'Review ticket #13 for Alex Rivera 13', exact: true });
  await review.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Review Full Record', exact: true })).toBeVisible();
  // Remount instead of making any clinical decisions.
  await mount(page);
  await page.getByRole('button', { name: 'Record updates', exact: true }).click();
  await expect(page.getByRole('table').getByText('Expired', { exact: true })).toBeVisible();
  await page.getByLabel('Scope', { exact: true }).selectOption('Dental');
  await expect(page.getByText('Sam Cruz', { exact: true })).toBeVisible();
  await expect(page.getByText('Ari Santos', { exact: true })).toHaveCount(0);
  await page.getByLabel('Branch', { exact: true }).selectOption('Manila');
  await expect(page.getByText('No update requests found', { exact: true })).toBeVisible();
});

test('light and dark queues reflow without horizontal overflow at phone, tablet and desktop widths', async ({ page }, testInfo) => {
  await mount(page);
  await page.getByRole('button', { name: 'All requests', exact: true }).click();
  await expect(page.getByText('Sam Cruz', { exact: true })).toBeVisible();
  for (const dark of [false, true]) {
    await page.evaluate(value => document.documentElement.classList.toggle('dark', value), dark);
    for (const width of [375, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      await expect(page.getByRole('row', { name: 'Review ticket #21 for Sam Cruz', exact: true })).toBeVisible();
      // Also verify the space left by the staff app's expanded desktop sidebar.
      if (width >= 768) {
        await page.locator('main').evaluate((main, availableWidth) => { main.style.width = `${availableWidth}px`; }, width - 224);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
        const bounds = await page.getByRole('table', { name: 'Record update requests' }).boundingBox();
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width - 224);
        await page.locator('main').evaluate(main => { main.style.width = ''; });
      }
      if (width === 375 || width === 1440) await page.screenshot({ path: testInfo.outputPath(`pending-${dark ? 'dark' : 'light'}-${width}.png`), fullPage: true, animations: 'disabled' });
    }
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.getByRole('button', { name: 'All requests', exact: true })).toHaveAttribute('aria-pressed', 'true');
});
