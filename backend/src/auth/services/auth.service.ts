import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { BusinessesRepository } from '../repositories/businesses.repository';
import { LoginDto } from '../dto/login.dto';
import type { AuthPrincipal } from '../../common/decorators/current-user.decorator';

@Injectable()
export class AuthService {
  constructor(
    private readonly businesses: BusinessesRepository,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(dto: LoginDto) {
    const loginId = dto.loginId.trim();
    const adminId = this.config.get<string>('SUPER_ADMIN_ID')?.trim();
    const adminPass = this.config.get<string>('SUPER_ADMIN_PASSWORD')?.trim();
    if (
      adminId &&
      adminPass &&
      loginId === adminId &&
      dto.password === adminPass
    ) {
      return {
        access_token: this.signSuperAdmin(),
        role: 'SUPER_ADMIN' as const,
      };
    }

    const business = await this.businesses.findByUniqueCode(loginId);
    const ok =
      business &&
      (await bcrypt.compare(dto.password, business.passwordHash));
    if (!ok) {
      throw new UnauthorizedException('Invalid credentials');
    }
    if (!business!.isActive) {
      throw new UnauthorizedException('Business account is inactive');
    }

    return {
      access_token: this.signBusiness({
        id: business!.id,
        uniqueCode: business!.uniqueCode,
      }),
      role: 'BUSINESS' as const,
      businessId: business!.uniqueCode,
      businessName: business!.name,
      id: business!.id,
    };
  }

  private signSuperAdmin() {
    return this.jwt.sign({
      sub: 'super-admin',
      role: 'SUPER_ADMIN',
    });
  }

  private signBusiness(b: { id: string; uniqueCode: string }) {
    return this.jwt.sign({
      sub: b.id,
      role: 'BUSINESS',
      businessId: b.uniqueCode,
    });
  }

  async getProfile(user: AuthPrincipal) {
    if (user.role !== 'BUSINESS') {
      throw new UnauthorizedException();
    }
    return this.businesses.findPublicProfile(user.sub);
  }

  async updateProfile(
    user: AuthPrincipal,
    body: {
      name?: string;
    },
  ) {
    if (user.role !== 'BUSINESS') {
      throw new UnauthorizedException();
    }
    return this.businesses.updatePublicProfile(user.sub, body);
  }
}
