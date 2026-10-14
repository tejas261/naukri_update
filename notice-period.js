// Calendar days, rather than elapsed 24-hour periods, keep joining answers stable
// across UTC/India midnight and daylight-saving transitions.
function noticeDetails(noticePeriod, lastWorkingDay, now = new Date(), timeZone = 'Asia/Kolkata') {
  if (!lastWorkingDay) {
    const days = /^\s*(\d+)\s*(?:days?\b|$)/i.exec(noticePeriod);
    return {
      noticePeriod,
      noticeDays: days ? days[1] : (/immediate|no notice/i.test(noticePeriod) ? '0' : ''),
      startDate: noticePeriod ? `I can start within ${noticePeriod}.` : '',
    };
  }
  const end = new Date(`${lastWorkingDay}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(lastWorkingDay) || !Number.isFinite(end.getTime()) ||
      end.toISOString().slice(0, 10) !== lastWorkingDay) {
    throw new Error('LAST_WORKING_DAY must be a valid YYYY-MM-DD date.');
  }
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(part => [part.type, part.value]));
  const today = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const days = Math.max(0, Math.round((end.getTime() - today) / 86400000));
  const date = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric',
  }).format(end);
  return {
    noticePeriod: `${days} days (last working day: ${date})`,
    noticeDays: String(days),
    startDate: today <= end.getTime()
      ? `I am serving notice. My last working day is ${date}.`
      : `My last working day was ${date}.`,
  };
}

module.exports = { noticeDetails };
