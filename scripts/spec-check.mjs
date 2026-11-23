// Checks rendered brand components against measurements taken from the Paper file.
// Every expectation names its source: C = Concept page, G## = Grammar sheet, M = Mock up.
//
//   pnpm spec                         builds, serves dist with vite preview, checks
//   SPEC_URL=http://localhost:5179/design-system pnpm spec   checks a running server
import {spawn} from 'node:child_process';
import {chromium} from 'playwright-core';

const SPECS = [
  // Grammar sheet 04, the six steps (computed styles on sheet 04 samples and the C statement).
  {source: 'G04 Display', selector: '[data-spec="type-display"] > *', css: {fontSize: '68px', lineHeight: '70px', fontWeight: '500', letterSpacing: '-2.04px'}},
  {source: 'G04 Head', selector: '[data-spec="type-head"] > *', css: {fontSize: '40px', lineHeight: '42px', fontWeight: '500', letterSpacing: '-1.2px'}},
  {source: 'G04 Subhead', selector: '[data-spec="type-subhead"] > *', css: {fontSize: '24px', lineHeight: '28px', fontWeight: '400', letterSpacing: 'normal'}},
  {source: 'G04 Body', selector: '[data-spec="type-body"] > *', css: {fontSize: '15px', lineHeight: '24px', fontWeight: '400'}},
  {source: 'G04 Caption', selector: '[data-spec="type-caption"] > *', css: {fontSize: '13px', lineHeight: '16px', fontWeight: '400'}},
  {source: 'G04 Label', selector: '[data-spec="type-label"] > *', css: {fontSize: '11px', lineHeight: '14px', fontWeight: '400', letterSpacing: '1.98px', textTransform: 'uppercase'}},
  {source: 'G04 every typeset face is Jost', selector: '[data-spec="type-body"] > *', css: {fontFamily: /^"Jost Variable"/}},

  // Concept D-0 and the Grammar scaffold: the section header.
  {source: 'C D-0 section header', selector: '[data-cjt="section-header"]', css: {alignItems: 'baseline', columnGap: '16px', paddingBottom: '18px', borderBottomWidth: '1px', borderBottomColor: 'rgb(228, 228, 228)'}},
  {source: 'C E-0 header label', selector: '[data-cjt="section-header"] > :first-child', css: {fontSize: '11px', lineHeight: '14px', letterSpacing: '1.98px', color: 'rgb(17, 17, 17)'}},
  {source: 'C F-0 header caption', selector: '[data-cjt="section-header"] > :nth-child(2)', css: {fontSize: '13px', lineHeight: '16px', color: 'rgb(118, 118, 118)'}},

  // Concept masthead and statement.
  {source: 'C 9-0 statement title', selector: '[data-cjt="page-header"] h1', css: {fontSize: '68px', lineHeight: '70px', fontWeight: '500', color: 'rgb(17, 17, 17)'}},
  {source: 'G scaffold lede, 520 measure', selector: '[data-cjt="lede"]', css: {fontSize: '15px', lineHeight: '24px', maxWidth: '520px'}},

  // Tiles.
  {source: 'C 1WP-0 tile, stage to caption', selector: '[data-cjt="tile"]', css: {rowGap: '18px'}},
  {source: 'C S-0 tile caption', selector: '[data-cjt="tile-caption"]', css: {rowGap: '5px'}},

  // Grammar sheet 02 custody rows and sheet 05 role rows.
  {source: 'G02 custody row', selector: '[data-cjt="rule-row"]', css: {columnGap: '24px', paddingTop: '16px', paddingBottom: '16px', borderBottomColor: 'rgb(228, 228, 228)'}},
  {source: 'G02 status column', selector: '[data-cjt="rule-row"] > :first-child', box: {width: 110}},
  {source: 'G02 rule name column', selector: '[data-cjt="rule-row"] > :nth-child(2)', box: {width: 300}},
  {source: 'G05 role row', selector: '[data-cjt="role-row"]', css: {columnGap: '24px', paddingTop: '16px', alignItems: 'center'}},
  {source: 'G05 role swatch 80x56', selector: '[data-cjt="role-chip"]', box: {width: 80, height: 56}},

  // Concept palette.
  {source: 'C 2B-0 swatch column', selector: '[data-cjt="swatch"]', css: {rowGap: '16px'}},
  {source: 'C 2C-0 swatch chip', selector: '[data-cjt="swatch-chip"]', box: {height: 150}},

  // Grammar sheet 06 flavour cards.
  {source: 'G06 flavour card', selector: '[data-cjt="flavour-card"]', css: {paddingTop: '28px', paddingLeft: '28px', justifyContent: 'space-between'}, box: {minHeight: 260}},

  // Mock up 03 menu board.
  {source: 'M 4OD-0 board', selector: '[data-cjt="menu-board"]', css: {paddingTop: '64px', paddingLeft: '56px', rowGap: '44px', backgroundColor: 'rgb(17, 17, 17)'}},
  {source: 'M 4OF-0 board head', selector: '[data-cjt="menu-head"]', css: {paddingBottom: '20px', borderBottomColor: 'rgb(74, 65, 54)', alignItems: 'baseline'}},
  {source: 'M 4ON-0 board row', selector: '[data-cjt="menu-item"]', css: {paddingTop: '22px', paddingBottom: '22px', columnGap: '24px', borderBottomColor: 'rgb(74, 65, 54)'}},
  {source: 'M 4OP-0 item name', selector: '[data-cjt="menu-item"] > :first-child > :first-child', css: {fontSize: '24px', lineHeight: '26px', fontWeight: '500', letterSpacing: '-0.72px', color: 'rgb(250, 224, 175)'}},
  {source: 'M 4OQ-0 item description', selector: '[data-cjt="menu-item"] > :first-child > :nth-child(2)', css: {fontSize: '13px', lineHeight: '17px', color: 'rgb(154, 144, 130)'}},
  {source: 'M 4OR-0 item price', selector: '[data-cjt="menu-item"] > :nth-child(2)', css: {fontSize: '24px', lineHeight: '26px', fontWeight: '400', color: 'rgb(250, 224, 175)'}},
  {source: 'M 4PK-0 footnote', selector: '[data-cjt="menu-board"] > :last-child > :last-child', css: {fontSize: '13px', lineHeight: '17px', color: 'rgb(250, 224, 175)'}},

  // Grammar sheet 04: the typeset wordmark. Jost Medium, caps, 0.2em, cobalt on light grounds.
  {source: 'G04 typeset wordmark', selector: '[data-cjt="flavour-card"] [data-cjt="wordmark"]', css: {fontWeight: '500', letterSpacing: '2.2px', textTransform: 'uppercase', color: 'rgb(3, 28, 254)'}},

  // Grammar sheet 05: no shadows, no gradients anywhere a brand component draws.
  {source: 'G05 no drop shadows on Astryx cards', selector: '.astryx-card', css: {boxShadow: 'none'}},
];

async function withServer(run) {
  if (process.env.SPEC_URL) return run(process.env.SPEC_URL);
  const sh = (cmd, args) =>
    new Promise((resolve, reject) => {
      const p = spawn(cmd, args, {stdio: 'inherit'});
      p.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited ${code}`))));
    });
  await sh('pnpm', ['exec', 'vite', 'build', '--logLevel', 'warn']);
  const server = spawn('pnpm', ['exec', 'vite', 'preview', '--port', '4179', '--strictPort'], {stdio: 'pipe'});
  await new Promise((resolve, reject) => {
    server.stdout.on('data', (d) => String(d).includes('4179') && resolve());
    server.on('exit', (code) => reject(new Error(`vite preview exited ${code}`)));
  });
  try {
    return await run('http://localhost:4179/design-system');
  } finally {
    server.kill();
  }
}

const failures = await withServer(async (url) => {
  const browser = await chromium.launch();
  const page = await browser.newPage({viewport: {width: 1440, height: 900}});
  await page.goto(url, {waitUntil: 'networkidle'});
  await page.evaluate(() => document.fonts.ready);
  const results = await page.evaluate((specs) => {
    return specs.map((spec) => {
      const els = [...document.querySelectorAll(spec.selector)];
      if (!els.length) return {source: spec.source, count: 0, problems: [`no element matches ${spec.selector}`]};
      const problems = new Set();
      for (const el of els) {
        const cs = getComputedStyle(el);
        const rect = el.getBoundingClientRect();
        for (const [prop, want] of Object.entries(spec.css ?? {})) {
          const got = cs[prop];
          const ok = typeof want === 'string' ? got === want : new RegExp(want.source).test(got);
          if (!ok) problems.add(`${prop}: want ${typeof want === 'string' ? want : '/' + want.source + '/'}, got ${got}`);
        }
        for (const [prop, want] of Object.entries(spec.box ?? {})) {
          const got = prop === 'minHeight' ? rect.height : rect[prop];
          const ok = prop === 'minHeight' ? got >= want - 0.5 : Math.abs(got - want) <= 0.5;
          if (!ok) problems.add(`${prop}: want ${want}px, got ${got.toFixed(2)}px`);
        }
      }
      return {source: spec.source, count: els.length, problems: [...problems]};
    });
  }, SPECS.map((s) => ({...s, css: Object.fromEntries(Object.entries(s.css ?? {}).map(([k, v]) => [k, v instanceof RegExp ? {source: v.source} : v]))})));
  const fontLoaded = await page.evaluate(() => document.fonts.check('16px "Jost Variable"'));
  await browser.close();
  results.push({source: 'Jost Variable actually loaded (not a fallback)', count: 1, problems: fontLoaded ? [] : ['document.fonts.check failed']});
  for (const r of results) console.log(`${r.problems.length ? 'FAIL' : 'ok  '}  ${r.source} (${r.count})${r.problems.length ? `\n        ${r.problems.join('\n        ')}` : ''}`);
  return results.filter((r) => r.problems.length);
});

console.log(`\n${SPECS.length + 1 - failures.length}/${SPECS.length + 1} specs match`);
process.exit(failures.length ? 1 : 0);
