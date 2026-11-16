import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  parseYekatPublicationDate, yekatDateTimeInput, publicationDateLabel,
  isNewsPublic, isNewsScheduled, publicNewsWhere,
} from '../src/lib/newsPublication.mjs';
const src = p => readFileSync(new URL(`../${p}`, import.meta.url), 'utf8');

test('Krasnoufimsk local time is UTC+05:00, not VPS/browser timezone', () => {
  assert.equal(parseYekatPublicationDate('2026-11-16T09:30').toISOString(), '2026-11-16T04:30:00.000Z');
  assert.equal(yekatDateTimeInput('2026-11-16T04:30:00.000Z'), '2026-11-16T09:30');
  assert.equal(publicationDateLabel('2026-11-16T04:30:00.000Z'), '16.11.2026 09:30 (UTC+5)');
});

test('New Year boundary keeps the Krasnoufimsk day', () => {
  assert.equal(parseYekatPublicationDate('2027-01-01T00:10').toISOString(), '2026-12-31T19:10:00.000Z');
});

test('Valid leap date accepted; invalid calendar dates rejected', () => {
  assert.ok(parseYekatPublicationDate('2028-02-29T23:59'));
  for(const value of ['2026-02-29T12:00','2026-04-31T09:00','2026-13-01T12:00','2026-01-01T24:00',
    '2026-01-01T09:60','2026-1-01T08:00','2026-01-01','2026-01-01T09:00Z',
    '2026-01-01T09:00+05:00','1999-12-31T10:00','2101-01-01T01:00', '', null]) {
    assert.equal(parseYekatPublicationDate(value), null, String(value));
  }
});

test('A future publishedAt is scheduled, hidden until due', () => {
  const now = new Date('2026-11-15T10:00:00Z');
  const post = {status:'PUBLISHED',publishedAt:new Date('2026-11-15T10:01:00Z')};
  assert.equal(isNewsScheduled(post,now),true);
  assert.equal(isNewsPublic(post,now),false);
  assert.equal(isNewsPublic(post,new Date('2026-11-15T10:01:00Z')),true);
  assert.equal(isNewsScheduled(post,new Date('2026-11-15T10:01:00Z')),false);
});

test('Backdated articles are immediately visible with selected publication time', () => {
  const now = new Date('2026-11-15T10:00:00Z');
  const post = {status:'PUBLISHED',publishedAt:parseYekatPublicationDate('2025-11-15T10:00')};
  assert.equal(isNewsPublic(post,now),true);
  assert.equal(isNewsScheduled(post,now),false);
});

test('Drafts, approved, withdrawn and missing dates never become public', () => {
  const now=new Date('2026-11-15T10:00:00Z');
  for(const status of ['DRAFT','REVIEW','APPROVED','UNPUBLISHED']) {
    assert.equal(isNewsPublic({status,publishedAt:new Date(2000,0,1)},now),false);
    assert.equal(isNewsScheduled({status,publishedAt:new Date('2030-01-01')},now),false);
  }
  assert.equal(isNewsPublic({status:'PUBLISHED',publishedAt:null},now),false);
  assert.equal(isNewsScheduled({status:'PUBLISHED',publishedAt:'bogus'},now),false);
});

test('Public DB filter uses <= current instant', () => {
  const now=new Date('2026-11-15T12:34:56Z');
  assert.deepEqual(publicNewsWhere(now),{status:'PUBLISHED',publishedAt:{lte:now}});
});

test('All public feeds including search and sitemap exclude future DB posts', () => {
  const news=src('src/lib/news.js');
  assert.match(news,/where: publicNewsWhere\(\)/);
  assert.match(news,/if \(!isNewsPublic\(post\)\) return null;/);
  const sitemap=src('src/app/sitemap.js');
  assert.match(sitemap,/getAllNews\(/);
  const search=src('src/app/search/page.js');
  assert.match(search,/getAllNews\(/);
});

test('Only administrator may publish and reschedule; scheduling uses compare-and-swap', () => {
  const api=src('src/app/api/editor/news/[id]/publication/route.js');
  assert.match(api,/user\.role !== "ADMIN"/);
  assert.match(api,/reschedule: \{ from: "PUBLISHED"/);
  assert.match(api,/isNewsScheduled\(post, now\)/);
  assert.match(api,/publishedAt: \{ gt: now \}/);
  assert.match(api,/status: step\.from, updatedAt: expectedAt/);
  assert.match(api,/publishedAt: publicationAt/);
});

test('Scheduled promotion happens before public status transition', () => {
  const api=src('src/app/api/editor/news/[id]/publication/route.js');
  assert.ok(api.indexOf('await promoteNewsImages(post)') < api.indexOf('const result = await prisma.$transaction'));
});

test('Live publications and selected featured headlines exclude future posts', () => {
  const api=src('src/app/api/editor/news/[id]/featured/route.js');
  assert.match(api,/isNewsPublic\(post, now\)/);
  assert.match(api,/publicNewsWhere\(now\)/);
  const review=src('src/app/editor/news/[id]/review/page.js');
  assert.match(review,/post\.status === "PUBLISHED" && !scheduled &&/);
});

test('Editor list has distinct scheduled filter and date labels', () => {
  const list=src('src/app/editor/news/page.js');
  assert.match(list,/SCHEDULED: "Запланировано"/);
  assert.match(list,/publishedAt: \{ gt: now \}/);
  assert.match(list,/publicNewsWhere\(now\)/);
});

test('Editor controls provide manual and dated publication, postponement and cancellation', () => {
  const actions=src('src/app/editor/news/[id]/review/ReviewActions.jsx');
  assert.match(actions,/type="datetime-local"/);
  assert.match(actions,/Опубликовать сейчас/);
  assert.match(actions,/execute\("reschedule", true\)/);
  assert.match(actions,/Отменить запланированную публикацию/);
  assert.match(actions,/publicationDate \} : \{\}/);
});
