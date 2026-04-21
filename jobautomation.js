const { handleApplication } = require('./automationService');
const fs = require('fs');
const path = require('path');

const DELAY_BETWEEN_JOBS = 4000; // ms to wait between each application

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

(async () => {
  // Load jobs from jobs.json (produced by jobscraping.js)
  const jobsPath = path.resolve(__dirname, 'jobs.json');
  if (!fs.existsSync(jobsPath)) {
    console.error('[jobautomation] jobs.json not found. Run: node jobscraping.js first');
    process.exit(1);
  }

  // Load profile
  const profilePath = path.resolve(__dirname, 'profile.json');
  if (!fs.existsSync(profilePath)) {
    console.error('[jobautomation] profile.json not found');
    process.exit(1);
  }

  const jobs = JSON.parse(fs.readFileSync(jobsPath, 'utf-8'));
  const profile = JSON.parse(fs.readFileSync(profilePath, 'utf-8'));

  console.log(`[jobautomation] Loaded ${jobs.length} jobs from jobs.json`);
  console.log(`[jobautomation] Starting auto-apply...\n`);

  let applied = 0;
  let failed = 0;

  for (let i = 0; i < jobs.length; i++) {
    const job = jobs[i];
    const targetUrl = job.applyLink || job.url;

    console.log(`[jobautomation] [${i + 1}/${jobs.length}] Applying to: "${job.title}"`);
    console.log(`[jobautomation]   URL: ${targetUrl}`);

    const result = await handleApplication(targetUrl, profile);

    if (result.success) {
      applied++;
      console.log(`[jobautomation]   ✓ Success: ${result.message}`);
    } else {
      failed++;
      console.log(`[jobautomation]   ✗ Failed: ${result.message}`);
    }

    console.log(`[jobautomation]   Progress: ${i + 1}/${jobs.length} | Applied: ${applied} | Failed: ${failed}\n`);

    if (i < jobs.length - 1) {
      console.log(`[jobautomation]   Waiting ${DELAY_BETWEEN_JOBS / 1000}s before next job...`);
      await sleep(DELAY_BETWEEN_JOBS);
    }
  }

  console.log(`\n[jobautomation] ✓ Done! Applied: ${applied} | Failed: ${failed} | Total: ${jobs.length}`);
})();