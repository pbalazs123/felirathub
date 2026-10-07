// Caches with expiry: always in memory (least recently used entries are evicted when a cache is
// full), and optionally on disk under CACHE_DIR so they survive restarts. Values are JSON data or
// Buffers. Concurrent lookups of the same key share one load. Failed loads are not cached.

const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');
const settings = require('./settings');

const registry = [];
const diskRoot = settings.cacheDir ? path.resolve(settings.cacheDir) : '';
const diskMaxBytes = settings.cacheDirMaxMegabytes * 1024 * 1024;

function sizeOf(value) {
  if (Buffer.isBuffer(value)) return value.length;
  return Buffer.byteLength(JSON.stringify(value) ?? '');
}

function encode(value, expiresAt) {
  const isBuffer = Buffer.isBuffer(value);
  return JSON.stringify({ expiresAt, buffer: isBuffer, value: isBuffer ? value.toString('base64') : value });
}

function decode(text) {
  const entry = JSON.parse(text);
  return { expiresAt: entry.expiresAt, value: entry.buffer ? Buffer.from(entry.value, 'base64') : entry.value };
}

class Cache {
  constructor(name, { label, maxEntries = 2000, maxBytes = 16 * 1024 * 1024, persist = false, hidden = false } = {}) {
    this.name = name;
    this.label = label || name;
    this.hidden = hidden; // internal caches the dashboard doesn't list
    this.maxEntries = maxEntries;
    this.maxBytes = maxBytes;
    this.dir = persist && diskRoot ? path.join(diskRoot, name) : '';
    this.memory = new Map();
    this.memoryBytes = 0;
    this.pending = new Map();
    this.counts = { hits: 0, diskHits: 0, misses: 0, evictions: 0 };
    registry.push(this);
  }

  fileFor(key) {
    return path.join(this.dir, `${crypto.createHash('sha256').update(key).digest('hex')}.json`);
  }

  remember(key, value, expiresAt) {
    this.forget(key);
    const size = sizeOf(value);
    if (size > this.maxBytes) return;
    this.memory.set(key, { value, expiresAt, size });
    this.memoryBytes += size;
    for (const oldest of this.memory.keys()) {
      if (this.memory.size <= this.maxEntries && this.memoryBytes <= this.maxBytes) break;
      this.forget(oldest);
      this.counts.evictions += 1;
    }
  }

  forget(key) {
    const entry = this.memory.get(key);
    if (!entry) return;
    this.memoryBytes -= entry.size;
    this.memory.delete(key);
  }

  fromMemory(key) {
    const entry = this.memory.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.forget(key);
      return undefined;
    }
    this.memory.delete(key); // move to the most recently used end
    this.memory.set(key, entry);
    return entry.value;
  }

  async fromDisk(key) {
    if (!this.dir) return undefined;
    try {
      const { value, expiresAt } = decode(await fs.readFile(this.fileFor(key), 'utf8'));
      if (expiresAt <= Date.now()) return undefined;
      this.remember(key, value, expiresAt);
      return value;
    } catch {
      return undefined;
    }
  }

  async toDisk(key, value, expiresAt) {
    if (!this.dir) return;
    try {
      await fs.mkdir(this.dir, { recursive: true });
      const file = this.fileFor(key);
      await fs.writeFile(`${file}.tmp`, encode(value, expiresAt));
      await fs.rename(`${file}.tmp`, file);
      scheduleDiskCount();
    } catch (error) {
      console.error(`[cache] could not write ${this.name}:`, error.message);
    }
  }

  // ttl: milliseconds, or a function of the loaded value returning milliseconds (0 = don't cache).
  async getOrLoad(key, load, ttl) {
    const cached = this.fromMemory(key);
    if (cached !== undefined) {
      this.counts.hits += 1;
      return cached;
    }
    if (this.pending.has(key)) {
      this.counts.hits += 1;
      return this.pending.get(key);
    }

    const promise = (async () => {
      const stored = await this.fromDisk(key);
      if (stored !== undefined) {
        this.counts.diskHits += 1;
        return stored;
      }
      this.counts.misses += 1;
      const value = await load();
      const ms = typeof ttl === 'function' ? ttl(value) : ttl;
      if (ms > 0) {
        const expiresAt = Date.now() + ms;
        this.remember(key, value, expiresAt);
        await this.toDisk(key, value, expiresAt);
      }
      return value;
    })().finally(() => this.pending.delete(key));

    this.pending.set(key, promise);
    return promise;
  }

  removeExpired() {
    const now = Date.now();
    for (const [key, entry] of this.memory) {
      if (entry.expiresAt <= now) this.forget(key);
    }
  }

  stats() {
    return {
      name: this.name,
      label: this.label,
      entries: this.memory.size,
      bytes: this.memoryBytes,
      maxBytes: this.maxBytes,
      persisted: Boolean(this.dir),
      ...this.counts
    };
  }
}

// Disk cleanup: delete expired files, then the oldest ones while over CACHE_DIR_MAX_MB.
async function cleanDisk() {
  if (!diskRoot) return { files: 0, bytes: 0 };
  const files = [];
  for (const cache of registry.filter((c) => c.dir)) {
    const names = await fs.readdir(cache.dir).catch(() => []);
    for (const name of names) {
      const file = path.join(cache.dir, name);
      try {
        const stat = await fs.stat(file);
        const { expiresAt } = JSON.parse(await fs.readFile(file, 'utf8'));
        if (expiresAt <= Date.now() || name.endsWith('.tmp')) await fs.rm(file, { force: true });
        else files.push({ file, size: stat.size, mtime: stat.mtimeMs });
      } catch {
        await fs.rm(file, { force: true });
      }
    }
  }
  files.sort((a, b) => a.mtime - b.mtime);
  let bytes = files.reduce((sum, f) => sum + f.size, 0);
  while (bytes > diskMaxBytes && files.length) {
    const oldest = files.shift();
    bytes -= oldest.size;
    await fs.rm(oldest.file, { force: true });
  }
  diskUsage = { files: files.length, bytes };
  return diskUsage;
}

let diskUsage = { files: 0, bytes: 0 };

// Recount the disk cache 30 seconds after writes (instead of only every 10 minutes).
let countTimer = null;
function scheduleDiskCount() {
  if (countTimer) return;
  countTimer = setTimeout(() => {
    countTimer = null;
    cleanDisk().catch(() => {});
  }, 30 * 1000);
  countTimer.unref();
}

setInterval(() => {
  registry.forEach((cache) => cache.removeExpired());
  cleanDisk().catch((error) => console.error('[cache] disk cleanup failed:', error.message));
}, 10 * 60 * 1000).unref();
if (diskRoot) setTimeout(() => cleanDisk().catch(() => {}), 5000).unref();

module.exports = {
  createCache: (name, options) => new Cache(name, options),
  cacheStats: () => ({
    caches: registry.filter((cache) => !cache.hidden).map((cache) => cache.stats()),
    disk: diskRoot ? { enabled: true, ...diskUsage, maxBytes: diskMaxBytes } : { enabled: false }
  })
};
