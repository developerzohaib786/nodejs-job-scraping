const { scrapeJobs } = require('./scraper');
const fs = require('fs');
const path = require('path');

const PAGES = 2; 

(async () => {
  console.log(`[jobscraping] Starting scrape for ${PAGES} page(s)...`);
  try {
    const jobs = await scrapeJobs(PAGES);
    console.log(`[jobscraping] Scraped ${jobs.length} jobs`);

    const outPath = path.resolve(__dirname, 'jobs.json');
    fs.writeFileSync(outPath, JSON.stringify(jobs, null, 2));
    console.log(`[jobscraping] Saved to ${outPath}`);
  } catch (err) {
    console.error('[jobscraping] Error:', err.message);
    process.exit(1);
  }
})();