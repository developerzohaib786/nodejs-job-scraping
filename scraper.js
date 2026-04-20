const https = require('https');

const API_URL = 'https://www.adecco.com/api/data/jobs/summarized';
const JOB_URL_BASE = 'https://www.adecco.com/en-ch/job-search?jobId=';

const BASE_BODY = {
  queryString:
    '&sort=PostingStartDate desc' +
    '&facet.pivot=IsRemote' +
    '&facet.range=Salary_Facet_Yearly' +
    '&f.Salary_Facet_Yearly.facet.range.start=0' +
    '&f.Salary_Facet_Yearly.facet.range.end=10000000' +
    '&f.Salary_Facet_Yearly.facet.range.gap=500' +
    '&facet.range=Salary_Facet_Hourly' +
    '&f.Salary_Facet_Hourly.facet.range.start=0' +
    '&f.Salary_Facet_Hourly.facet.range.end=850' +
    '&f.Salary_Facet_Hourly.facet.range.gap=5',
  filtersToDisplay:
    '{7FEB8D10-300F-4942-AA2D-D54B994541E7}|{153DFF72-744A-440B-A2ED-DBAA6BC4C978}|{8DFDA1D6-96EB-4552-BDCB-F70FA9A5ADE5}|{93137178-D7CE-47F4-BA91-D70F4F77D5C1}',
  siteName: 'adecco',
  brand: 'adecco',
  countryCode: 'CH',
  languageCode: 'en-CH',
};

function postJson(url, body) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(body);
    const options = {
      method: 'POST',
      headers: {
        'content-type': 'text/plain;charset=UTF-8',
        'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        referer: 'https://www.adecco.com/en-ch/job-search',
        'content-length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`JSON parse failed (status ${res.statusCode}): ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

async function scrapeJobs(pages) {
  const allJobs = [];
  const scrapedAt = new Date().toISOString();

  for (let page = 0; page < pages; page++) {
    const range = page * 10;
    console.log(`Fetching page ${page + 1}/${pages} (range=${range})...`);

    const data = await postJson(API_URL, { ...BASE_BODY, range });
    const jobs = data.jobs || [];

    // useless comment
    
    if (jobs.length === 0) {
      console.log('No more jobs returned.');
      break;
    }

    for (const j of jobs) {
      allJobs.push({
        id: j.jobId,
        title: j.jobTitle || '',
        company: j.brandName || 'Adecco',
        location: j.jobLocation || '',
        url: JOB_URL_BASE + j.jobId,
        jobType: j.contractTypeTitle || '',
        employmentType: j.employmentTypeTitle || '',
        industry: j.jobSubCategoryTitle || '',
        scrapedAt,
      });
    }

    console.log(`  Got ${jobs.length} jobs (total: ${allJobs.length})`);
  }

  return allJobs;
}

module.exports = { scrapeJobs };
