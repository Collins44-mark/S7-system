import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from '../services/auth.service';
import { LoginDto } from '../dto/login.dto';
import {
  CurrentUser,
  type AuthPrincipal,
} from '../../common/decorators/current-user.decorator';
import { Roles } from '../decorators/roles.decorator';
import { RolesGuard } from '../guards/roles.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('BUSINESS')
  @Get('me')
  me(@CurrentUser() user: AuthPrincipal) {
    return this.auth.getProfile(user);
  }

  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('BUSINESS')
  @Patch('me')
  updateMe(
    @CurrentUser() user: AuthPrincipal,
    @Body()
    body: {
      name?: string;
    },
  ) {
    return this.auth.updateProfile(user, body);
  }
}
