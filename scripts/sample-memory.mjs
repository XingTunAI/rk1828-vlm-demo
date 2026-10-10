import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdir, appendFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const exec = promisify(execFile);
const seconds = Number(process.argv[2] ?? 60);
if (!Number.isInteger(seconds) || seconds < 5 || seconds > 28800) {
  throw new Error('Usage: node scripts/sample-memory.mjs [durationSeconds: 5..28800]');
}
const directory = resolve('results', `memory-${Date.now()}`);
await mkdir(directory, { recursive: true });
const file = resolve(directory, 'samples.jsonl');
console.log(`Memory samples: ${file}`);
let stopping = false;
process.on('SIGINT', () => { stopping = true; });
const start = performance.now();
const adbArgs = process.env.ANDROID_SERIAL ? ['-s', process.env.ANDROID_SERIAL] : [];
while (!stopping && performance.now() - start < seconds * 1000) {
  const sample = { timestamp: new Date().toISOString(), elapsedMs: performance.now() - start };
  try {
    const { stdout } = await exec('adb', [...adbArgs, 'shell',
      'rknn-smi info -t memory && cat /proc/meminfo'], { timeout: 15000, maxBuffer: 1024 * 1024 });
    const total = stdout.match(/Total DDR Capacity\(MB\)\s*:\s*([\d.]+)/);
    const free = stdout.match(/Free DDR Capacity\(MB\)\s*:\s*([\d.]+)/);
    const hostTotal = stdout.match(/^MemTotal:\s*(\d+) kB/m);
    const hostAvailable = stdout.match(/^MemAvailable:\s*(\d+) kB/m);
    sample.acceleratorTotalMB = total ? Number(total[1]) : null;
    sample.acceleratorFreeMB = free ? Number(free[1]) : null;
    sample.hostTotalKiB = hostTotal ? Number(hostTotal[1]) : null;
    sample.hostAvailableKiB = hostAvailable ? Number(hostAvailable[1]) : null;
    sample.raw = stdout;
    if (!total || !free || !hostAvailable) sample.error = 'Some memory fields are missing; inspect raw output';
  } catch (error) {
    sample.error = error.message;
  }
  sample.sampleDurationMs = performance.now() - start - sample.elapsedMs;
  await appendFile(file, `${JSON.stringify(sample)}\n`);
  console.log(JSON.stringify({ ...sample, raw: undefined }));
  const remaining = seconds * 1000 - (performance.now() - start);
  if (!stopping && remaining > 0) await new Promise(resolve => setTimeout(resolve, Math.min(5000, remaining)));
}
