import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const page = readFileSync(new URL('../src/app/events/cinema/page.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/app/events/cinema/cinema.module.css', import.meta.url), 'utf8');
const catalog = readFileSync(new URL('../src/lib/cinemaCatalog.mjs', import.meta.url), 'utf8');

test('long descriptions have a native accessible expand and collapse control', () => {
    assert.match(page, /movie\.summary\.length > 170/);
    assert.match(page, /<details className=\{styles\.synopsis\}>/);
    assert.match(page, /<summary className=\{styles\.synopsisSummary\}>/);
    assert.match(page, /Читать полностью/);
    assert.match(page, /Свернуть/);
});
test('full description still exists, and short descriptions are visible', () => {
    assert.match(page, /synopsisFull\}>\{movie\.summary\}/);
    assert.match(page, /synopsisShort\}>\{movie\.summary\}/);
    assert.match(css, /synopsis\[open\] \.synopsisTeaser/);
});
test('mobile synopsis is full width below the poster/title and above sessions', () => {
    assert.match(css, /\.synopsisShort\s*\{\s*grid-column: 1 \/ -1;\s*grid-row: 2/);
    assert.match(css, /\.schedule\s*\{\s*grid-column: 1 \/ -1;\s*grid-row: 3/);
    assert.ok(page.indexOf('className={styles.synopsis}') < page.indexOf('className={styles.schedule}'));
});
test('mobile typography, spacing and teaser are compact', () => {
    assert.match(css, /-webkit-line-clamp:\s*3/);
    assert.match(css, /font-size: 19px/);
    assert.match(css, /font-size: 13px/);
    assert.match(css, /font-size: 12px/);
});
test('original cinema data, times, and safety constraints remain unchanged', () => {
    assert.match(page, /getCinemaMovies/);
    assert.match(page, /Asia\/Yekaterinburg/);
    assert.match(page, /screening\.hallName/);
    assert.match(page, /screening\.price/);
    assert.match(catalog, /pushkinCard: false/);
    assert.doesNotMatch(page, /fetch\(|\.post\(|\.create\(/);
});
