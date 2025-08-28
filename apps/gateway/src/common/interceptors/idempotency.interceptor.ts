import { Injectable, NestInterceptor, ExecutionContext, CallHandler, BadRequestException } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class IdempotencyInterceptor implements NestInterceptor {
  private idempotencyStore = new Map<string, { timestamp: number; response: any }>();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const idempotencyKey = request.headers['idempotency-key'];

    if (!idempotencyKey) {
      return next.handle();
    }

    // Check if we've seen this key before
    const existing = this.idempotencyStore.get(idempotencyKey);
    const now = Date.now();

    if (existing) {
      // If the key is older than 24 hours, consider it expired
      if (now - existing.timestamp > 24 * 60 * 60 * 1000) {
        this.idempotencyStore.delete(idempotencyKey);
      } else {
        // Return the cached response
        return new Observable(subscriber => {
          subscriber.next(existing.response);
          subscriber.complete();
        });
      }
    }

    return next.handle().pipe(
      tap(response => {
        // Cache the response for future requests with the same key
        this.idempotencyStore.set(idempotencyKey, {
          timestamp: now,
          response,
        });
      }),
    );
  }
}
