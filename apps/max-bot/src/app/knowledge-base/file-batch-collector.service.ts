import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Subject, Subscription, merge, timer } from 'rxjs';
import { switchMap, take, map } from 'rxjs/operators';

interface UserBatch {
  ctx$: Subject<unknown>;
  flush$: Subject<void>;
  subscription: Subscription;
  done: Promise<void>;
  resolveDone: () => void;
}

@Injectable()
export class FileBatchCollectorService implements OnModuleDestroy {
  private readonly batches = new Map<number, UserBatch>();

  private static readonly DEBOUNCE_MS = 5000;

  push<T>(userId: number, ctx: T, onFlush: (latestCtx: T) => void): void {
    let batch = this.batches.get(userId);

    if (!batch) {
      batch = this.createBatch(userId, onFlush as (latestCtx: unknown) => void);
      this.batches.set(userId, batch);
    }

    batch.ctx$.next(ctx);
  }

  async flush(userId: number): Promise<void> {
    const batch = this.batches.get(userId);
    if (!batch) return;

    batch.flush$.next();
    await batch.done;
  }

  isCollecting(userId: number): boolean {
    return this.batches.has(userId);
  }

  cleanup(userId: number): void {
    const batch = this.batches.get(userId);
    if (!batch) return;

    batch.subscription.unsubscribe();
    batch.ctx$.complete();
    batch.flush$.complete();
    this.batches.delete(userId);
  }

  onModuleDestroy(): void {
    for (const [userId] of this.batches) {
      this.cleanup(userId);
    }
  }

  private createBatch(userId: number, onFlush: (latestCtx: unknown) => void): UserBatch {
    const ctx$ = new Subject<unknown>();
    const flush$ = new Subject<void>();

    let resolveDone!: () => void;
    const done = new Promise<void>((resolve) => {
      resolveDone = resolve;
    });

    const subscription = ctx$
      .pipe(
        switchMap((latestCtx) =>
          merge(
            timer(FileBatchCollectorService.DEBOUNCE_MS),
            flush$,
          ).pipe(
            take(1),
            map(() => latestCtx),
          ),
        ),
      )
      .subscribe((latestCtx) => {
        this.batches.delete(userId);
        ctx$.complete();
        flush$.complete();
        onFlush(latestCtx);
        resolveDone();
      });

    return { ctx$, flush$, subscription, done, resolveDone };
  }
}
