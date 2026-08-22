export class RuntimeScheduler {
  private active = true;
  private readonly intervals = new Set<NodeJS.Timeout>();
  private readonly timeouts = new Set<NodeJS.Timeout>();

  get isActive(): boolean {
    return this.active;
  }

  setInterval(callback: () => void, delayMs: number): NodeJS.Timeout {
    if (!this.active) throw new Error('Runtime scheduler has stopped');
    const handle = setInterval(() => {
      if (this.active) callback();
    }, delayMs);
    this.intervals.add(handle);
    return handle;
  }

  setTimeout(callback: () => void, delayMs: number): NodeJS.Timeout | null {
    if (!this.active) return null;
    const handle = setTimeout(() => {
      this.timeouts.delete(handle);
      if (this.active) callback();
    }, delayMs);
    this.timeouts.add(handle);
    return handle;
  }

  clearTimeout(handle: NodeJS.Timeout | null): void {
    if (!handle) return;
    clearTimeout(handle);
    this.timeouts.delete(handle);
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    for (const handle of this.intervals) clearInterval(handle);
    for (const handle of this.timeouts) clearTimeout(handle);
    this.intervals.clear();
    this.timeouts.clear();
  }
}
