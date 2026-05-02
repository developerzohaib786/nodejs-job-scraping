require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { scrapeJobs } = require('./scraper');
const { handleApplication } = require('./automationService');
const { Translate } = require('@google-cloud/translate').v2;

const app = express();
app.use(cors());
app.use(express.json());
const PORT = process.env.PORT || 3001;

const translate = new Translate({ key: process.env.GOOGLE_TRANSLATION_KEY });
// ci/cd pipeline testing comment 

app.get('/', (req, res) => {
  res.send('Node.js Scraper API is running!');
});

app.get('/getalljobs/:pages', async (req, res) => {
  const pages = parseInt(req.params.pages, 10);

  if (isNaN(pages) || pages < 1) {
    return res.status(400).json({ success: false, error: 'pages must be a positive integer' });
  }

  try {
    console.log(`GET /getalljobs/${pages}`);
    const jobs = await scrapeJobs(pages);
    const body = JSON.stringify({ success: true, count: jobs.length, jobs });
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Length', Buffer.byteLength(body));
    res.end(body);
  } catch (err) {
    console.error('Error in /getalljobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/translate', async (req, res) => {
  const { jobs } = req.body;

  if (!Array.isArray(jobs)) {
    return res.status(400).json({ success: false, error: '"jobs" array is required' });
  }

  try {
    const titles = jobs.map(j => j.title || '');
    const [translations] = await translate.translate(titles, 'en');
    const translatedJobs = jobs.map((job, i) => ({
      ...job,
      title: Array.isArray(translations) ? translations[i] : translations,
    }));
    res.json({ success: true, count: translatedJobs.length, jobs: translatedJobs });
  } catch (err) {
    console.error('Error in /translate:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/apply', async (req, res) => {
  const { job, profile } = req.body;

  if (!job?.url || !profile) {
    return res.status(400).json({ success: false, error: '"job.url" and "profile" are required' });
  }



  // Use applyLink (rcf.adecco.com quick-apply) if available, otherwise fall back to job page
  const targetUrl = job.applyLink || job.url;

  res.status(202).json({ success: true, message: 'Application processing started', jobUrl: targetUrl });

  handleApplication(targetUrl, profile)
    .then(result => console.log(`[/apply] ${targetUrl} →`, result.message))
    .catch(err => console.error(`[/apply] Error:`, err.message));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`  GET http://localhost:${PORT}/getalljobs/:pages`);
});
