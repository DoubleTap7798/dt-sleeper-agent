const fs = require('fs');

if (!fs.existsSync('site')) {
  fs.mkdirSync('site');
}

fs.writeFileSync('site/dtsleeper-planner-2027.ics', icsContent);


const path = require('path');
const YAML = require('yaml');

function formatDate(dt) {
  return dt.replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
}

function escapeText(s) {
  return (s || '').replace(/\n/g, '\\n').replace(/,/g, '\\,');
}

const plan = YAML.parse(fs.readFileSync('plan.yaml', 'utf8'));
let out = [];
out.push('BEGIN:VCALENDAR');
out.push('VERSION:2.0');
out.push(`PRODID:-//DT Sleeper Agent//${plan.meta.calendar_name}//EN`);

for (const e of plan.events) {
  out.push('BEGIN:VEVENT');
  out.push(`UID:${e.id}@dtsleeperagent.com`);
  out.push(`DTSTAMP:${formatDate(e.start || new Date().toISOString())}`);
  if (e.start) out.push(`DTSTART:${formatDate(e.start)}`);
  if (e.end) out.push(`DTEND:${formatDate(e.end)}`);
  if (e.rrule) out.push(`RRULE:${e.rrule}`);
  out.push(`SUMMARY:${escapeText(e.title)}`);
  if (e.description) out.push(`DESCRIPTION:${escapeText(e.description)}`);
  if (e.alarms && Array.isArray(e.alarms)) {
    for (const a of e.alarms) {
      out.push('BEGIN:VALARM');
      if (a.trigger) out.push(`TRIGGER:${a.trigger}`);
      out.push(`ACTION:${a.action || 'DISPLAY'}`);
      if (a.description) out.push(`DESCRIPTION:${escapeText(a.description)}`);
      out.push('END:VALARM');
    }
  }
  out.push('END:VEVENT');
}

out.push('END:VCALENDAR');

fs.mkdirSync('site', { recursive: true });
fs.writeFileSync(path.join('site', 'dtsleeper-planner-2027.ics'), out.join('\r\n'));
console.log('ICS generated to site/dtsleeper-planner-2027.ics');
