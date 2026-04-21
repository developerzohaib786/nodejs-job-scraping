const { chromium } = require('playwright');
const path = require('path');

const RESUME_PATH = path.resolve(__dirname, 'uploads', 'resume.pdf');
const STEALTH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function acceptCookies(page) {
  try {
    await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 8000 });
    await page.click('#onetrust-accept-btn-handler');
    console.log('[/apply] Cookies accepted');
    await page.waitForTimeout(1500);
  } catch {
    console.log('[/apply] No cookie banner, continuing...');
  }
}

async function handleAdeccoQuickApply(page, profile) {
  const { personalInfo } = profile;

  await page.waitForLoadState('load', { timeout: 60000 });
  // Wait until the form is actually rendered (slow connections)
  await page.waitForSelector('input[name="denomination"]', { timeout: 60000 });
  await acceptCookies(page);
  await page.waitForTimeout(1000);

  console.log('[/apply] Filling form on:', page.url());

  // Salutation — input[name="denomination"] value="Mr" or "Ms"
  const salutation = personalInfo.salutation || 'Mr';
  await page.check(`input[name="denomination"][value="${salutation}"]`);
  console.log('[/apply] Salutation:', salutation);
  await page.waitForTimeout(300);

  // First name
  await page.fill('input[name="firstName"]', personalInfo.firstName);
  console.log('[/apply] First name:', personalInfo.firstName);

  // Last name
  await page.fill('input[name="lastName"]', personalInfo.lastName);
  console.log('[/apply] Last name:', personalInfo.lastName);

  // Email
  await page.fill('input[name="email"]', personalInfo.email);
  console.log('[/apply] Email:', personalInfo.email);

  // Phone prefix — select[name="phonePrefix"], Pakistan value="+92"
  await page.selectOption('select[name="phonePrefix"]', { value: '+92' });
  console.log('[/apply] Phone prefix: +92 (Pakistan)');

  // Phone number — strip +92 and any dashes/spaces
  const rawPhone = personalInfo.phone.replace(/^\+92[-\s]?/, '').replace(/[-\s]/g, '');
  await page.fill('input[name="phone"]', rawPhone);
  console.log('[/apply] Phone:', rawPhone);

  // Preferred contact language — select[name="preferredLanguage"], English value="en-US"
  await page.selectOption('select[name="preferredLanguage"]', { value: 'en-US' });
  console.log('[/apply] Language: English');

  await page.waitForTimeout(500);

  // CV upload — input[name="cv"]
  await page.setInputFiles('input[name="cv"]', RESUME_PATH);
  console.log('[/apply] CV uploaded');
  await page.waitForTimeout(2000);

  // Marketing consent checkbox (optional)
  await page.check('input[data-testid="checkbox-marketingConsent"]');
  console.log('[/apply] Marketing consent checked');

  // Privacy policy checkbox (required)
  await page.check('input[data-testid="checkbox-privacy"]');
  console.log('[/apply] Privacy policy checked');

  // Terms and conditions checkbox (required)
  await page.check('input[data-testid="checkbox-terms"]');
  console.log('[/apply] Terms checked');

  await page.waitForTimeout(1000);

  // Submit
  await page.click('button[data-testid="candidate-web-apply-button"]');
  console.log('[/apply] Form submitted!');
  await page.waitForTimeout(2000);
}

async function handleApplication(jobUrl, profile) {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 80,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ userAgent: STEALTH_UA });
  const page = await context.newPage();

  try {
    await page.goto(jobUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });

    const hostname = new URL(jobUrl).hostname;

    if (hostname.includes('rcf.adecco.com')) {
      await handleAdeccoQuickApply(page, profile);

    } else if (hostname.includes('adecco.com')) {
      await page.waitForLoadState('load', { timeout: 20000 });
      await acceptCookies(page);
      await page.waitForTimeout(2000);

      const applyBtn = page.locator('button, a').filter({ hasText: /apply for job/i }).first();
      await applyBtn.waitFor({ timeout: 10000 });
      console.log('[/apply] Clicking Apply For Job...');

      const [newPage] = await Promise.all([
        context.waitForEvent('page', { timeout: 15000 }),
        applyBtn.click(),
      ]);

      await handleAdeccoQuickApply(newPage, profile);
    }

    await page.waitForTimeout(4000);
    return { success: true, message: 'Application submitted successfully' };
  } catch (err) {
    console.error('[/apply] Error:', err.message);
    return { success: false, message: err.message };
  } finally {
    await browser.close();
  }
}

module.exports = { handleApplication };