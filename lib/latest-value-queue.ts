type QueueErrorHandler = (error: unknown) => void;

/**
 * Runs one asynchronous write at a time and retains only the newest value while
 * a write is in flight. This is suitable for replaceable telemetry such as a
 * vehicle's current position, where replaying every stale sample would increase
 * load and could move the displayed vehicle backwards.
 */
export class LatestValueQueue<T> {
  private latest: T | undefined;
  private running: Promise<void> | null = null;
  private accepting = true;

  constructor(
    private readonly worker: (value: T) => Promise<void>,
    private readonly onError?: QueueErrorHandler,
  ) {}

  enqueue(value: T) {
    if (!this.accepting) return;
    this.latest = value;
    if (!this.running) {
      this.running = this.drain().finally(() => {
        this.running = null;
        if (this.accepting && this.latest !== undefined) this.enqueue(this.latest);
      });
    }
  }

  async whenIdle() {
    while (this.running) await this.running;
  }

  stop() {
    this.accepting = false;
    this.latest = undefined;
  }

  private async drain() {
    while (this.latest !== undefined) {
      const value = this.latest;
      this.latest = undefined;
      try {
        await this.worker(value);
      } catch (error) {
        this.onError?.(error);
      }
    }
  }
}
