import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * Ensures Prisma Decimal / BigInt serialize cleanly as JSON strings.
 */
function serialize(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }
  if (typeof value === 'bigint') {
    return value.toString();
  }
  if (typeof value === 'object') {
    if (
      typeof (value as { toJSON?: () => unknown }).toJSON === 'function'
    ) {
      try {
        const j = (value as { toJSON: () => unknown }).toJSON();
        if (typeof j === 'string' || typeof j === 'number') {
          return j;
        }
      } catch {
        /* fall through */
      }
    }
    const ctor = (value as object).constructor?.name;
    if (ctor === 'Decimal' || ctor === 'PrismaDecimal') {
      return String(value);
    }
    if (Array.isArray(value)) {
      return value.map(serialize);
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = serialize(v);
    }
    return out;
  }
  return value;
}

@Injectable()
export class SerializeInterceptor implements NestInterceptor {
  intercept(_ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(map((data) => serialize(data)));
  }
}
