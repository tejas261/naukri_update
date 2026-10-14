// Interactive login only: does not run the profile updater or application scripts.
const { chromium } = require('playwright-core');
const { dataPath, browserOptions } = require('../../runtime');
const targets = {
  refresh: ['.naukri-chrome-profile', 'https://www.naukri.com/nlogin/login'],
  naukri: ['.naukri-apply-profile', 'https://www.naukri.com/nlogin/login'],
  wellfound: ['.wellfound-chrome-profile', 'https://wellfound.com/login'],
  indeed: ['.indeed-chrome-profile', 'https://in.indeed.com/account/login'],
};

(async () => {
  const target = targets[process.argv[2]];
  if (!target) throw new Error('Choose refresh, naukri, wellfound, or indeed.');
  const ctx = await chromium.launchPersistentContext(dataPath(target[0]), {
    ...browserOptions(), headless: false, viewport: { width: 1280, height: 850 },
  });
  const close = () => ctx.close().catch(() => {});
  process.once('SIGTERM', close);
  process.once('SIGINT', close);
  const closed = new Promise(resolve => ctx.once('close', resolve));
  try {
    const page = ctx.pages()[0] || await ctx.newPage();
    await page.goto(target[1], { waitUntil: 'domcontentloaded', timeout: 60000 });
    console.log('Log in through the SSH/VNC connection, then close the browser window to save the session.');
    await closed;
  } finally {
    await close();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
