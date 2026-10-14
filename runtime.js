const fs = require('fs');
const path = require('path');

// Desktop installs keep their existing paths. Containers mount one persistent directory.
const dataDir = path.resolve(process.env.DATA_DIR || __dirname);
fs.mkdirSync(dataDir, { recursive: true });
const dataPath = (name) => path.join(dataDir, name);

function browserOptions() {
  if (process.env.BROWSER_EXECUTABLE_PATH) {
    return { executablePath: process.env.BROWSER_EXECUTABLE_PATH };
  }
  // The version-matched Playwright container includes an ARM64 browser.
  const channel = process.env.BROWSER_CHANNEL || 'chrome';
  return channel === 'bundled' ? {} : { channel };
}

module.exports = { dataDir, dataPath, browserOptions };
