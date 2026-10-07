// System health for the dashboard: event-loop delay, container memory and disk usage.

const fs = require('node:fs');
const os = require('node:os');
const { monitorEventLoopDelay } = require('node:perf_hooks');
const settings = require('./settings');

// How late the server reacts to work; long stalls make requests and health checks time out.
const loop = monitorEventLoopDelay({ resolution: 20 });
loop.enable();

function readNumber(file) {
  try {
    const text = fs.readFileSync(file, 'utf8').trim();
    return text === 'max' ? null : Number(text);
  } catch {
    return null;
  }
}

// Memory of the container (cgroup v2, then v1); outside containers, of the whole machine.
function containerMemory() {
  const used = readNumber('/sys/fs/cgroup/memory.current') ?? readNumber('/sys/fs/cgroup/memory/memory.usage_in_bytes');
  if (used === null) return null;
  let limit = readNumber('/sys/fs/cgroup/memory.max') ?? readNumber('/sys/fs/cgroup/memory/memory.limit_in_bytes');
  if (!limit || limit > os.totalmem()) limit = os.totalmem();
  const peak = readNumber('/sys/fs/cgroup/memory.peak') ?? readNumber('/sys/fs/cgroup/memory/memory.max_usage_in_bytes');
  return { used, limit, peak };
}

function disk() {
  const where = settings.cacheDir || '/';
  try {
    const stat = fs.statfsSync(where);
    const total = stat.blocks * stat.bsize;
    return { path: where, total, used: total - stat.bavail * stat.bsize };
  } catch {
    return null;
  }
}

const ms = (nanoseconds) => Math.round((nanoseconds / 1e6) * 10) / 10;

function systemHealth() {
  return {
    eventLoop: { p99: ms(loop.percentile(99)), median: ms(loop.percentile(50)), mean: ms(loop.mean), worst: ms(loop.max) },
    container: containerMemory(),
    disk: disk()
  };
}

module.exports = { systemHealth };
