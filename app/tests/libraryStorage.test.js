import test from 'node:test';
import assert from 'node:assert/strict';
import { createLibraryStorage, readLibraryRaw, LibraryStorageError } from '../src/libraryStorage.js';

const KEY = 'assets-test';
function memoryStorage(entries = {}) {
  const values = new Map(Object.entries(entries));
  return {
    writes: [], reads: [],
    getItem(key) { this.reads.push(key); return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { this.writes.push([key, value]); values.set(key, value); },
    removeItem(key) { values.delete(key); },
    clear() { values.clear(); },
  };
}
const guard = (storage, expectedRaw) => createLibraryStorage({ storage, key: KEY, expectedRaw });
const stale = operation => assert.throws(operation, error => error instanceof LibraryStorageError
  && error.code === 'STORAGE_STALE' && /当前修改未保存/.test(error.message));

test('fresh library saves against initial absence and advances only its successful baseline', () => {
  const storage = memoryStorage();
  const initialRaw = readLibraryRaw({ storage, key: KEY });
  assert.equal(initialRaw, null);
  const writer = guard(storage, initialRaw);
  assert.deepEqual(writer.save('{"revision":1}'), { saved: true, changed: true, raw: '{"revision":1}' });
  assert.equal(writer.getExpectedRaw(), '{"revision":1}');
  assert.equal(storage.getItem(KEY), '{"revision":1}');
  writer.save('{"revision":2}');
  assert.equal(writer.getExpectedRaw(), '{"revision":2}');
  assert.equal(storage.writes.length, 2);
});

test('a completed save in a second tab blocks a stale tab without replacing its draft or latest saved data', () => {
  const initial = '{"revision":1}';
  const storage = memoryStorage({ [KEY]: initial });
  const tabA = guard(storage, initial), tabB = guard(storage, initial);
  const draft = { title: '尚未保存的本地草稿' };
  tabB.save('{"revision":2,"title":"其他标签页"}');
  stale(() => tabA.save(JSON.stringify(draft)));
  assert.equal(storage.getItem(KEY), '{"revision":2,"title":"其他标签页"}');
  assert.equal(tabA.getExpectedRaw(), initial);
  assert.equal(storage.writes.length, 1);
  assert.equal(JSON.stringify(draft), '{"title":"尚未保存的本地草稿"}');
  // A rejected save never silently adopts the other tab's baseline.
  stale(() => tabA.save('{"revision":3}'));
});

test('deletion of the library key is detected instead of recreating stale data', () => {
  const storage = memoryStorage({ [KEY]: 'old' });
  const writer = guard(storage, 'old');
  storage.removeItem(KEY);
  stale(() => writer.save('draft'));
  assert.equal(storage.getItem(KEY), null);
  assert.equal(storage.writes.length, 0);
  assert.equal(writer.getExpectedRaw(), 'old');
});

test('clearing storage and first-save races are detected, while unrelated keys do not block saves', () => {
  const storage = memoryStorage({ [KEY]: 'old', another: 'unrelated' });
  const writer = guard(storage, 'old');
  storage.clear();
  stale(() => writer.save('draft'));
  const firstTab = guard(storage, null), secondTab = guard(storage, null);
  secondTab.save('new-first-save');
  stale(() => firstTab.save('stale-first-save'));
  storage.setItem('another', 'changed');
  assert.equal(secondTab.save('next').saved, true);
});

test('same-content saves skip writing but still check the loaded raw baseline', () => {
  const storage = memoryStorage({ [KEY]: 'same' });
  const writer = guard(storage, 'same');
  assert.deepEqual(writer.save('same'), { saved: true, changed: false, raw: 'same' });
  assert.equal(storage.writes.length, 0);
  assert.equal(storage.reads.length, 1);
  storage.setItem(KEY, 'different');
  stale(() => writer.save('same'));
  // Equal desired/actual content does not authorize silently accepting a stale baseline either.
  stale(() => writer.save('different'));
  assert.equal(writer.getExpectedRaw(), 'same');
});

test('readCurrentRaw observes data but never resets the expected snapshot', () => {
  const storage = memoryStorage({ [KEY]: 'old' });
  const writer = guard(storage, 'old');
  storage.setItem(KEY, 'new');
  assert.equal(writer.readCurrentRaw(), 'new');
  assert.equal(writer.getExpectedRaw(), 'old');
  stale(() => writer.save('overwrite'));
});

test('unavailable storage reads are explicit, preserve the baseline and do not write', () => {
  const storage = memoryStorage({ [KEY]: 'old' });
  const writer = guard(storage, 'old');
  storage.getItem = () => { throw new Error('permission'); };
  assert.throws(() => writer.save('draft'), error => error.code === 'STORAGE_READ_FAILED' && /未保存/.test(error.message));
  assert.equal(writer.getExpectedRaw(), 'old');
  assert.equal(storage.writes.length, 0);
  assert.throws(() => readLibraryRaw({ storage, key: KEY }), error => error.code === 'STORAGE_READ_FAILED');
});

test('failed writes never advance the guard and can retry against unchanged storage', () => {
  const storage = memoryStorage({ [KEY]: 'old' });
  const writer = guard(storage, 'old');
  const normalWrite = storage.setItem.bind(storage);
  storage.setItem = () => { throw new Error('quota'); };
  assert.throws(() => writer.save('draft'), error => error.code === 'STORAGE_WRITE_FAILED' && /草稿仍保留/.test(error.message));
  assert.equal(writer.getExpectedRaw(), 'old');
  assert.equal(storage.getItem(KEY), 'old');
  storage.setItem = normalWrite;
  assert.equal(writer.save('draft').saved, true);
  assert.equal(writer.getExpectedRaw(), 'draft');
});

test('raw comparison catches equal-revision edits and distinguishes empty text from absent storage', () => {
  const initial = '{"revision":1,"title":"old"}';
  const storage = memoryStorage({ [KEY]: initial });
  const writer = guard(storage, initial);
  storage.setItem(KEY, '{"revision":1,"title":"changed"}');
  stale(() => writer.save('{"revision":2}'));
  const emptyStorage = memoryStorage({ [KEY]: '' });
  assert.equal(readLibraryRaw({ storage: emptyStorage, key: KEY }), '');
  stale(() => guard(emptyStorage, null).save('new'));
  assert.equal(guard(emptyStorage, '').save('recovered').saved, true);
});

test('invalid initialization and nonserialized values fail before storage mutation', () => {
  const storage = memoryStorage();
  assert.throws(() => createLibraryStorage({ storage, key: KEY }), /载入时/);
  assert.throws(() => guard(storage, undefined), /载入时/);
  assert.throws(() => createLibraryStorage({ storage, key: '', expectedRaw: null }), /存储标识/);
  const writer = guard(storage, null);
  assert.throws(() => writer.save({ revision: 1 }), /序列化/);
  assert.throws(() => writer.save(null), /序列化/);
  assert.equal(storage.writes.length, 0);
});
