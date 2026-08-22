import { uIOhook } from 'uiohook-napi';

interface UtilityParentPort {
  postMessage(message: unknown): void;
  on(event: 'message', listener: (event: { data: unknown }) => void): void;
}

const parentPort = (process as NodeJS.Process & { parentPort?: UtilityParentPort }).parentPort;
let pendingCount = 0;
let stopped = false;

function stop(): void {
  if (stopped) return;
  stopped = true;
  clearInterval(flushTimer);
  try { uIOhook.stop(); } catch { /* the worker is already shutting down */ }
}

uIOhook.on('keydown', () => { pendingCount += 1; });
uIOhook.start();
parentPort?.postMessage({ type: 'ready' });

const flushTimer = setInterval(() => {
  if (!pendingCount) return;
  const count = pendingCount;
  pendingCount = 0;
  parentPort?.postMessage({ type: 'key-bucket', count, endedAt: Date.now() });
}, 250);

parentPort?.on('message', ({ data }) => {
  if (data && typeof data === 'object' && (data as { type?: unknown }).type === 'stop') {
    stop();
    process.exit(0);
  }
});

process.once('exit', stop);
