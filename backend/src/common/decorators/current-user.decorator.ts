import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/** JWT-validated principal attached by JwtStrategy */
export type SuperAdminPrincipal = {
  role: 'SUPER_ADMIN';
  sub: 'super-admin';
};

export type BusinessPrincipal = {
  role: 'BUSINESS';
  sub: string;
  businessId: string;
};

export type AuthPrincipal = SuperAdminPrincipal | BusinessPrincipal;

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthPrincipal => {
    const req = ctx.switchToHttp().getRequest<{ user: AuthPrincipal }>();
    return req.user;
  },
);
