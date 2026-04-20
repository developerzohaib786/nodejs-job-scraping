const express = require('express');
const { scrapeJobs } = require('./scraper');

const app = express();
const PORT = process.env.PORT || 3000;

app.get('/getalljobs/:pages', async (req, res) => {
  const pages = parseInt(req.params.pages, 10);

  if (isNaN(pages) || pages < 1) {
    return res.status(400).json({ success: false, error: 'pages must be a positive integer' });
  }

  try {
    console.log(`GET /getalljobs/${pages}`);
    const jobs = await scrapeJobs(pages);
    res.json({ success: true, count: jobs.length, jobs });
  } catch (err) {
    console.error('Error in /getalljobs:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`  GET http://localhost:${PORT}/getalljobs/:pages`);
});
