import { LatestValueQueue } from '@/lib/latest-value-queue';

describe('LatestValueQueue', () => {
  test('serializes work and coalesces pending values to the newest sample', async () => {
    const releases: Array<() => void> = [];
    const started: number[] = [];
    const queue = new LatestValueQueue<number>((value) => {
      started.push(value);
      return new Promise<void>((resolve) => releases.push(resolve));
    });

    queue.enqueue(1);
    queue.enqueue(2);
    queue.enqueue(3);
    expect(started).toEqual([1]);

    releases.shift()?.();
    await Promise.resolve();
    expect(started).toEqual([1, 3]);

    releases.shift()?.();
    await queue.whenIdle();
    expect(started).toEqual([1, 3]);
  });

  test('reports a failed write and continues with the newest pending value', async () => {
    const errors: unknown[] = [];
    const completed: number[] = [];
    const queue = new LatestValueQueue<number>(async (value) => {
      if (value === 1) throw new Error('offline');
      completed.push(value);
    }, (error) => errors.push(error));

    queue.enqueue(1);
    queue.enqueue(2);
    await queue.whenIdle();

    expect(errors).toHaveLength(1);
    expect(completed).toEqual([2]);
  });

  test('drops new values after it is stopped', async () => {
    const completed: number[] = [];
    const queue = new LatestValueQueue<number>(async (value) => {
      completed.push(value);
    });

    queue.stop();
    queue.enqueue(1);
    await queue.whenIdle();
    expect(completed).toEqual([]);
  });
});
