import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

@Injectable()
export class RateLimitGuard implements CanActivate {
  private requestCounts = new Map<string, { count: number; resetTime: number }>();

  private getClientIdentifier(request: Request): string {
    // Use IP address as primary identifier
    const ip = request.ip || request.connection.remoteAddress || 'unknown';
    
    // For authenticated users, also include user ID for more granular limits
    const userId = (request as any).user?.userId;
    return userId ? `${ip}:${userId}` : ip;
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientId = this.getClientIdentifier(request);
    const now = Date.now();

    // Default rate limit: 100 requests per minute
    const config: RateLimitConfig = {
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
    };

    const current = this.requestCounts.get(clientId);

    if (!current || now > current.resetTime) {
      // First request or window expired
      this.requestCounts.set(clientId, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return true;
    }

    if (current.count >= config.maxRequests) {
      throw new HttpException(
        {
          type: 'https://api.aicoaching.com/problems/429',
          title: 'Too Many Requests',
          status: 429,
          detail: 'Rate limit exceeded. Please try again later.',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Increment request count
    current.count++;
    return true;
  }
}
