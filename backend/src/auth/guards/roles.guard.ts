import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthPrincipal } from '../../common/decorators/current-user.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles =
      this.reflector.getAllAndOverride<
        ('SUPER_ADMIN' | 'BUSINESS')[]
      >(ROLES_KEY, [context.getHandler(), context.getClass()]) ?? [];
    if (!roles.length) {
      return true;
    }
    const req = context.switchToHttp().getRequest<{ user?: AuthPrincipal }>();
    const user = req.user;
    if (!user?.role) {
      throw new UnauthorizedException();
    }
    if (!roles.includes(user.role)) {
      throw new ForbiddenException();
    }
    return true;
  }
}
