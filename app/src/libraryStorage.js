/** Storage errors intentionally omit saved content so UI messages cannot expose raw library data. */
export class LibraryStorageError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'LibraryStorageError';
    this.code = code;
    if (cause !== undefined) this.cause = cause;
  }
}

function requireStorage(storage, key) {
  if (!storage || typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new TypeError('需要提供可读取和写入的本机存储。');
  }
  if (typeof key !== 'string' || !key.length) throw new TypeError('本机资产库需要非空存储标识。');
}

/** Read without adopting a new baseline. Callers decide how to parse or recover invalid library data. */
export function readLibraryRaw({ storage, key }) {
  requireStorage(storage, key);
  try {
    const raw = storage.getItem(key);
    if (raw !== null && typeof raw !== 'string') throw new TypeError('存储返回了非文本记录。');
    return raw;
  } catch (cause) {
    throw new LibraryStorageError('STORAGE_READ_FAILED', '无法读取本机资产库，当前修改未保存。请保留草稿或导出当前资产库，再检查浏览器存储权限。', cause);
  }
}

/**
 * Guard a tab's local snapshot against a previously completed save in another tab/window.
 * expectedRaw MUST be the raw value used when loading the current in-memory document.
 * The synchronous read/check/write is not a cross-tab lock or a transactional compare-and-swap:
 * a simultaneous interleaving between the check and the write is still possible.
 */
export function createLibraryStorage({ storage, key, expectedRaw } = {}) {
  requireStorage(storage, key);
  if (expectedRaw !== null && typeof expectedRaw !== 'string') throw new TypeError('必须提供本次载入时的原始记录；新资产库请使用 null。');
  let expected = expectedRaw;
  return Object.freeze({
    readCurrentRaw() { return readLibraryRaw({ storage, key }); },
    getExpectedRaw() { return expected; },
    save(nextRaw) {
      if (typeof nextRaw !== 'string') throw new TypeError('待保存的资产库必须先序列化为文本。');
      const actual = readLibraryRaw({ storage, key });
      if (actual !== expected) {
        throw new LibraryStorageError('STORAGE_STALE', '本机资产库已在其他标签页或窗口中更改，也可能已被清除。当前修改未保存，草稿仍保留；请先导出当前资产库，再重新加载最新记录后重试。');
      }
      if (nextRaw === expected) return { saved: true, changed: false, raw: nextRaw };
      try {
        storage.setItem(key, nextRaw);
      } catch (cause) {
        throw new LibraryStorageError('STORAGE_WRITE_FAILED', '本机资产库写入失败，当前修改未保存，草稿仍保留。请导出当前资产库，再检查浏览器存储权限或剩余空间。', cause);
      }
      expected = nextRaw;
      return { saved: true, changed: true, raw: nextRaw };
    },
  });
}
