// Draws the banner at the top of the profile. The Earth at sunrise as a
// halftone of dots, looking down on the Gulf with Dubai marked; the name over
// its night side; and along the bottom one line for each day of the last
// year, longer on busier days. No dependencies.
//
//   node build.mjs            reads the public contribution calendar
//   GITHUB_TOKEN=… node …     asks the GitHub API instead (what the workflow does)
//
// If the data cannot be read the old pictures are left alone.
// The lettering is Inter (SIL Open Font License), stored as outlines in type.json.
// The Earth is drawn once into art.json from Natural Earth's public-domain coastlines.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";

const LOGIN = "ronitdhansoia";
const NAME = "Ronit Dhansoia";
const WEEKS = 53;
const TYPE = JSON.parse(readFileSync(new URL("./type.json", import.meta.url), "utf8"));
const ART = JSON.parse(readFileSync(new URL("./art.json", import.meta.url), "utf8"));

/* ---------- the year ---------- */
const LEVELS = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };

async function fromApi(token) {
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionLevel}}}}}}`;
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { authorization: `bearer ${token}`, "content-type": "application/json", "user-agent": "profile-banner" },
    body: JSON.stringify({ query, variables: { login: LOGIN } }),
  });
  if (!res.ok) throw new Error(`GitHub API answered ${res.status}`);
  const weeks = (await res.json())?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!weeks) throw new Error("GitHub API sent no calendar");
  return weeks.flatMap((w) => w.contributionDays.map((d) => ({ date: d.date, level: LEVELS[d.contributionLevel] ?? 0 })));
}

async function fromPage() {
  const res = await fetch(`https://github.com/users/${LOGIN}/contributions`, { headers: { "user-agent": "Mozilla/5.0 profile-banner" } });
  if (!res.ok) throw new Error(`github.com answered ${res.status}`);
  const html = await res.text();
  const days = [];
  for (const [tag] of html.matchAll(/<td[^>]*data-date="[^"]+"[^>]*>/g)) {
    const date = tag.match(/data-date="(\d{4}-\d\d-\d\d)"/)?.[1];
    const level = tag.match(/data-level="(\d)"/)?.[1];
    if (date && level) days.push({ date, level: Number(level) });
  }
  return days;
}

/* ---------- the picture ---------- */
const W = 960, H = 464;
const MARGIN = 48;
const CAP = 100; // height of the name's capitals
const LINE_1 = 194, LINE_2 = 318; // baselines of the two lines of the name
const HORIZON = 342;
const TICKS_TOP = HORIZON + 9;
const TICK = [3, 13, 25, 39, 55]; // length of a day's line, by how busy it was
const NOTE = 15; // size of the small lettering
const TOP_NOTE = 64, FOOT_NOTE = 430;

const THEMES = {
  dark: { field: "#000000", edge: "#26262a", name: "#f5f5f7", note: "#86868b", rule: "#3a3a3e", sun: "#1f45ff", ticks: ["#3a3a3e", "#6e6e73", "#a1a1a6", "#d2d2d7", "#ffffff"], air: 0.7, glint: 0.95, star: "#6e6e73", mark: "#ffffff" },
  light: { field: "#f5f5f7", edge: "#d2d2d7", name: "#000000", note: "#6e6e73", rule: "#c7c7cc", sun: "#1f45ff", ticks: ["#c7c7cc", "#8e8e93", "#636366", "#3a3a3c", "#000000"], air: 0.3, glint: 0.35, star: "", mark: "#1f45ff" },
};

const n = (v) => Number(v.toFixed(2));

/** A line of small lettering as outlines. anchor: "start" or "end". */
function note(text, x, y, anchor = "start") {
  const k = NOTE / TYPE.notes.upm;
  const glyphs = [...text].map((ch) => TYPE.notes.glyphs[ch] ?? TYPE.notes.glyphs[" "]);
  const width = glyphs.reduce((sum, g) => sum + g.adv, 0) * k;
  let pen = anchor === "end" ? x - width : x;
  return glyphs
    .map((g) => {
      const at = pen;
      pen += g.adv * k;
      return g.d ? `<path transform="translate(${n(at)} ${y}) scale(${n(k * 1000) / 1000})" d="${g.d}"/>` : "";
    })
    .join("");
}

function draw(theme, days, caption) {
  const t = THEMES[theme];
  const right = W - MARGIN;
  const k = CAP / TYPE.name.cap;
  const [first, second] = TYPE.name.lines;
  const [dx, dy] = ART.dubai;
  const [sx, sy] = ART.sun;
  // The stems of R and D line up with the left margin, not their side bearings.
  const line = (l, y) => `<path transform="translate(${n(MARGIN - l.left * k)} ${y}) scale(${k.toFixed(5)})" d="${l.d}"/>`;

  // One line per day along the bottom.
  const pitch = (right - MARGIN) / days.length;
  const byWeek = [];
  days.forEach((day, i) => {
    const x = MARGIN + (i + 0.5) * pitch;
    const colour = t.ticks[day.level];
    const week = (byWeek[Math.floor(i / 7)] ??= {});
    week[colour] = (week[colour] ?? "") + `M${n(x)} ${TICKS_TOP}v${TICK[day.level]}`;
  });
  const ticks = byWeek
    .map((week, i) => `<g class="w" style="animation-delay:${700 + i * 20}ms">${Object.entries(week).map(([colour, d]) => `<path stroke="${colour}" d="${d}"/>`).join("")}</g>`)
    .join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">${NAME}</title>
<desc id="d">${NAME}, ${caption.role}. Behind the name, the Earth at sunrise drawn in dots, seen from above the Gulf with Dubai marked. Along the bottom, one thin line for each day of the last year, longer on busier days. ${caption.right}.</desc>
<style>
.w{transform-origin:0 ${TICKS_TOP}px;animation:fall .6s cubic-bezier(.2,.8,.2,1) both}
.dawn{animation:dawn 2.6s cubic-bezier(.2,.7,.2,1) both}
.ping{transform-origin:${dx}px ${dy}px;animation:ping 3.2s ease-out 2s infinite}
@keyframes fall{from{transform:scaleY(0)}}
@keyframes dawn{from{opacity:0}}
@keyframes ping{0%{transform:scale(.4);opacity:.9}70%,100%{transform:scale(2.6);opacity:0}}
@media (prefers-reduced-motion:reduce){*{animation:none!important}}
</style>
<defs>
<clipPath id="frame"><rect x="1" y="1" width="${W - 2}" height="${H - 2}" rx="13"/></clipPath>
<radialGradient id="air" gradientUnits="userSpaceOnUse" cx="${ART.cx}" cy="${ART.cy}" r="${n(ART.r * 1.09)}"><stop offset=".74" stop-color="${t.sun}" stop-opacity="0"/><stop offset=".915" stop-color="${t.sun}" stop-opacity="${t.air}"/><stop offset="1" stop-color="${t.sun}" stop-opacity="0"/></radialGradient>
<linearGradient id="day" gradientUnits="userSpaceOnUse" x1="${n(ART.cx - ART.r * 0.45)}" y1="${n(ART.cy + ART.r * 0.47)}" x2="${n(ART.cx + ART.r * 0.5)}" y2="${n(ART.cy - ART.r * 0.52)}"><stop offset="0" stop-color="#000"/><stop offset="1" stop-color="#fff"/></linearGradient>
<linearGradient id="sink" gradientUnits="userSpaceOnUse" x1="0" y1="280" x2="0" y2="346"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000"/></linearGradient>
<mask id="lit" maskUnits="userSpaceOnUse" x="0" y="0" width="${W}" height="${H}"><rect width="${W}" height="${H}" fill="url(#day)"/><rect width="${W}" height="${H}" fill="url(#sink)"/></mask>
<radialGradient id="glint" gradientUnits="userSpaceOnUse" cx="${sx}" cy="${sy}" r="150"><stop offset="0" stop-color="#fff" stop-opacity="${t.glint}"/><stop offset=".07" stop-color="#fff" stop-opacity="${n(t.glint * 0.6)}"/><stop offset=".22" stop-color="${t.sun}" stop-opacity="${n(t.glint * 0.42)}"/><stop offset="1" stop-color="${t.sun}" stop-opacity="0"/></radialGradient>
</defs>
<rect x=".5" y=".5" width="${W - 1}" height="${H - 1}" rx="14" fill="${t.field}" stroke="${t.edge}"/>
<g clip-path="url(#frame)">
${t.star ? `<path d="${ART.stars.map(([x, y]) => `M${x} ${y}h0`).join("")}" stroke="${t.star}" stroke-width="1.3" stroke-linecap="round"/>` : ""}
<g class="dawn">
<g mask="url(#lit)"><circle cx="${ART.cx}" cy="${ART.cy}" r="${n(ART.r * 1.09)}" fill="url(#air)"/></g>
<g fill="none" stroke-linecap="round">${ART.dots[theme].map(([colour, width, d]) => `<path stroke="${colour}" stroke-width="${width}" d="${d}"/>`).join("")}</g>
<circle cx="${sx}" cy="${sy}" r="150" fill="url(#glint)"/>
</g>
<circle class="ping" cx="${dx}" cy="${dy}" r="7" fill="none" stroke="${t.sun}" stroke-width="1.5"/>
<circle cx="${dx}" cy="${dy}" r="3.4" fill="${t.mark}" stroke="${t.field}" stroke-width="1.5"/>
</g>
<g fill="${t.name}">${line(first, LINE_1)}${line(second, LINE_2)}</g>
<g fill="none" stroke-width="1.2">
${ticks}
</g>
<g fill="${t.note}">
${note(caption.role, MARGIN, TOP_NOTE)}
</g><g fill="${t.name}">${note(caption.place, dx + 13, dy + 5)}</g><g fill="${t.note}">
${note(caption.left, MARGIN, FOOT_NOTE)}
${note(caption.right, right, FOOT_NOTE, "end")}
</g>
</svg>
`;
}

/* ---------- run ---------- */
try {
  const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  const all = token ? await fromApi(token) : await fromPage();
  if (all.length < 300) throw new Error(`Only ${all.length} days read; expected about a year`);

  all.sort((a, b) => a.date.localeCompare(b.date));
  const days = all.slice(-WEEKS * 7);
  const active = days.filter((d) => d.level > 0).length;
  const month = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", year: "numeric", timeZone: "UTC" });
  const caption = {
    role: "Co-founder, Sharq",
    place: "Dubai",
    left: `One line a day, ${month(days[0].date)} to ${month(days[days.length - 1].date)}`,
    right: `Active on ${active} days`,
  };

  mkdirSync(new URL("./assets/", import.meta.url), { recursive: true });
  for (const theme of Object.keys(THEMES)) {
    writeFileSync(new URL(`./assets/banner-${theme}.svg`, import.meta.url), draw(theme, days, caption));
  }
  console.log(`Drew ${days.length} days. ${caption.left}. ${caption.right}.`);
} catch (error) {
  console.error(`Banner not redrawn: ${error.message}`);
  process.exitCode = 1;
}
