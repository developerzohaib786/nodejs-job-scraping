const { chromium } = require('playwright');

const JOB_URL_BASE = 'https://www.adecco.com/en-ch/job-search?jobId=';
const STEALTH_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

async function scrapeJobs(pages) {
  const allJobs = [];
  const scrapedAt = new Date().toISOString();

  const browser = await chromium.launch({
    headless: false,
    slowMo: 80,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  const context = await browser.newContext({ userAgent: STEALTH_UA });
  const page = await context.newPage();

  try {
    console.log('[scraper] Navigating to Adecco job search...');
    await page.goto('https://www.adecco.com/en-ch/job-search', {
      waitUntil: 'domcontentloaded',
      timeout: 60000,
    });

    // Accept cookies
    try {
      await page.waitForSelector('#onetrust-accept-btn-handler', { timeout: 10000 });
      await page.click('#onetrust-accept-btn-handler');
      console.log('[scraper] Cookies accepted');
      await page.waitForTimeout(1500);
    } catch {
      console.log('[scraper] No cookie banner, continuing...');
    }

    for (let pageNum = 0; pageNum < pages; pageNum++) {
      console.log(`\n[scraper] ─── Page ${pageNum + 1}/${pages} ───`);

      // Wait for job cards to render
      await page.waitForSelector('.card.mb2.p2', { timeout: 30000 });
      await page.waitForTimeout(1000);

      // Get all job cards on current page
      const cards = await page.$$('.card.mb2.p2');
      console.log(`[scraper] Found ${cards.length} job cards`);

      for (let i = 0; i < cards.length; i++) {
        try {
          // Re-query cards after each click (DOM may update)
          const currentCards = await page.$$('.card.mb2.p2');
          const card = currentCards[i];
          if (!card) continue;

          // Extract visible text from card
          const cardData = await card.evaluate(el => {
            const title = el.querySelector('.card-header p')?.textContent?.trim() || '';
            const paragraphs = Array.from(el.querySelectorAll('.card-body p'));
            const industry = paragraphs[0]?.textContent?.trim() || '';
            const location = paragraphs[1]?.textContent?.trim() || '';
            const divTexts = Array.from(el.querySelectorAll('.card-body .subtitle.text-01'))
              .map(d => d.textContent.trim())
              .filter(t => t !== industry && t !== location);
            const jobType = divTexts[0] || '';
            const employmentType = divTexts[1] || '';
            return { title, industry, location, jobType, employmentType };
          });

          // Click card and wait for URL to update with jobId
          const prevUrl = page.url();
          await card.click();

          // Wait until URL actually changes to include a new jobId
          try {
            await page.waitForFunction(
              (prev) => window.location.href !== prev && window.location.href.includes('jobId='),
              prevUrl,
              { timeout: 5000 }
            );
          } catch {
            // URL didn't change — still try to read it
          }

          const url = page.url();
          const jobIdMatch = url.match(/jobId=([a-f0-9-]+)/i);
          const jobId = jobIdMatch ? jobIdMatch[1] : null;

          if (!jobId) {
            console.log(`[scraper]   Card ${i + 1}: Could not extract jobId, skipping`);
            continue;
          }

          allJobs.push({
            id: String(jobId),
            title: String(cardData.title || ''),
            company: 'ADECCO',
            location: String(cardData.location || ''),
            url: JOB_URL_BASE + jobId,
            applyLink: null,
            jobType: String(cardData.jobType || ''),
            employmentType: String(cardData.employmentType || ''),
            industry: String(cardData.industry || ''),
            scrapedAt,
          });

          console.log(`[scraper]   [${i + 1}/${cards.length}] "${cardData.title}" — ${cardData.location}`);
          await page.waitForTimeout(300);

        } catch (err) {
          console.log(`[scraper]   Card ${i + 1} error: ${err.message}`);
        }
      }

      console.log(`[scraper] Page ${pageNum + 1} done. Total so far: ${allJobs.length} jobs`);

      // Navigate to next page if more pages needed
      if (pageNum < pages - 1) {
        try {
          const nextBtn = page.locator('button.paginator-icon[aria-label="Navigate next"]');
          const isDisabled = await nextBtn.isDisabled();
          if (isDisabled) {
            console.log('[scraper] Next button disabled, no more pages.');
            break;
          }
          console.log('[scraper] Clicking next page...');
          await nextBtn.click();
          await page.waitForTimeout(2000);
          await page.waitForSelector('.card.mb2.p2', { timeout: 30000 });
          console.log('[scraper] Next page loaded');
        } catch (err) {
          console.log('[scraper] Could not navigate to next page:', err.message);
          break;
        }
      }
    }

    console.log(`\n[scraper] ✓ Scraping complete. Total jobs: ${allJobs.length}`);
  } finally {
    await browser.close();
  }

  return allJobs;
}

module.exports = { scrapeJobs };