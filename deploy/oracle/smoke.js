// No job-site requests. Verify headed ARM browser, persistence, and container memory.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const { chromium } = require('playwright-core');
const { dataPath, browserOptions } = require('../../runtime');

(async () => {
  const server = http.createServer((req, res) => {
    res.end('<title>Oracle browser smoke check</title><p>Browser ready</p>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  const profile = fs.mkdtempSync(dataPath('smoke-profile-'));
  let ctx;
  const launch = () => chromium.launchPersistentContext(profile, {
    ...browserOptions(), headless: false, viewport: { width: 1280, height: 850 },
  });
  try {
    ctx = await launch();
    let page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(url);
    assert.equal(await page.title(), 'Oracle browser smoke check');
    await page.evaluate(() => localStorage.setItem('persistence-check', 'saved'));
    console.log(`Headed browser ready: ${ctx.browser().version()} on ${process.arch}`);
    await ctx.close();
    ctx = await launch();
    page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(url);
    assert.equal(await page.evaluate(() => localStorage.getItem('persistence-check')), 'saved');
    console.log('Browser profile persisted across launches.');
    const peak = '/sys/fs/cgroup/memory.peak';
    if (fs.existsSync(peak)) {
      console.log(`Container peak memory: ${Math.ceil(Number(fs.readFileSync(peak, 'utf8')) / 1024 / 1024)} MiB (smoke workload only).`);
    }
  } finally {
    if (ctx) await ctx.close();
    server.close();
    fs.rmSync(profile, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
