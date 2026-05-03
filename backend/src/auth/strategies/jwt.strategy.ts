import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type {
  AuthPrincipal,
  SuperAdminPrincipal,
} from '../../common/decorators/current-user.decorator';
import { BusinessesRepository } from '../repositories/businesses.repository';

type JwtPayload = {
  sub: string;
  role: 'SUPER_ADMIN' | 'BUSINESS';
  businessId?: string;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly businesses: BusinessesRepository,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<AuthPrincipal> {
    if (payload.role === 'SUPER_ADMIN') {
      if (payload.sub !== 'super-admin') {
        throw new UnauthorizedException();
      }
      const admin: SuperAdminPrincipal = {
        role: 'SUPER_ADMIN',
        sub: 'super-admin',
      };
      return admin;
    }

    if (payload.role === 'BUSINESS' && payload.businessId) {
      const row = await this.businesses.findByIdForAuth(payload.sub);
      if (!row || !row.isActive) {
        throw new UnauthorizedException('Business account is inactive or missing');
      }
      if (row.uniqueCode !== payload.businessId) {
        throw new UnauthorizedException();
      }
      const biz = {
        role: 'BUSINESS' as const,
        sub: row.id,
        businessId: row.uniqueCode,
      };
      return biz;
    }

    throw new UnauthorizedException();
  }
}
