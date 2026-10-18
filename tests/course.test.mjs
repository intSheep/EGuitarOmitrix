import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateCourse, videoUrl, primaryLessons, filterEntries, relatedEntries, readCursor, rememberVideo } from '../app/course.js';

const course = JSON.parse(await readFile(new URL('../app/data/course.json', import.meta.url), 'utf8'));

test('catalog preserves 140 unique source pages and 66 current teaching exercises', () => {
  validateCourse(course);
  assert.equal(course.entries.length, 140);
  assert.deepEqual(course.entries.map(e => e.page), Array.from({ length: 140 }, (_, i) => i + 1));
  assert.equal(primaryLessons(course).length, 66);
  assert.equal(primaryLessons(course, 1).length, 9);
  assert.equal(course.entries.filter(e => e.legacy).length, 16);
});

test('every episode navigates to its own page and stable cid', () => {
  for (const entry of course.entries) {
    const url = new URL(videoUrl(course, entry));
    assert.equal(url.origin, 'https://www.bilibili.com');
    assert.equal(url.pathname, '/video/BV1FT411Z7iu/');
    assert.equal(Number(url.searchParams.get('p')), entry.page);
    assert.equal(url.searchParams.get('cid'), entry.id);
  }
  const p70 = course.entries.find(e => e.page === 70);
  assert.equal(new URL(videoUrl(course, p70, 828.51)).searchParams.get('t'), '828');
  assert.throws(() => videoUrl(course, { id: 'nope', page: 1 }));
  assert.throws(() => videoUrl(course, { ...p70, page: 1 }));
  assert.throws(() => videoUrl(course, p70, -1));
});

test('duplicate identity or page rejects a malformed catalog', () => {
  const bad = structuredClone(course);
  bad.entries.push(bad.entries[0]);
  assert.throws(() => validateCourse(bad));
});

test('stage/search/type filters keep missing subtitles and make old editions opt-in', () => {
  assert.equal(filterEntries(course, { query: 'P070' })[0].page, 70);
  assert.equal(filterEntries(course, { query: '非C调' })[0].page, 70);
  assert.equal(filterEntries(course, { stage: 1, kind: 'lesson' }).length, 9);
  assert.equal(filterEntries(course).length, 124);
  assert.equal(filterEntries(course, { includeLegacy: true }).length, 140);
  assert.equal(filterEntries(course, { query: 'P017' })[0].hasSubtitles, false);
  assert.equal(filterEntries(course, { query: '<img onerror=alert(1)>' }).length, 0);
});

test('shared backing tracks link to EX5 and EX6 without mixing revisions', () => {
  for (const page of [7, 8]) {
    assert.ok(relatedEntries(course, course.entries.find(e => e.page === page)).some(e => e.page === 9));
  }
  assert.ok(relatedEntries(course, course.entries.find(e => e.page === 71)).every(e => !e.legacy));
});

test('navigation cursor stores no practice result and tolerates disabled storage', () => {
  const store = new Map();
  const storage = { getItem: key => store.get(key), setItem: (key, value) => store.set(key, value) };
  assert.equal(readCursor(storage, course), null);
  const lesson = course.entries[2];
  assert.equal(rememberVideo(storage, lesson), true);
  assert.equal(readCursor(storage, course).id, lesson.id);
  assert.deepEqual(Object.keys(JSON.parse([...store.values()][0])), ['version', 'entryId']);
  store.set('eguitar:navigation:v1', '{bad');
  assert.equal(readCursor(storage, course), null);
  assert.equal(rememberVideo({ setItem() { throw new Error('Disabled'); } }, lesson), false);
  assert.equal(readCursor({ getItem() { throw new Error('Disabled'); } }, course), null);
});
