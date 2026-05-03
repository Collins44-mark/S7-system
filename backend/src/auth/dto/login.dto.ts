import { IsString, Matches, MinLength } from 'class-validator';

export class LoginDto {
  @IsString()
  @MinLength(1)
  @Matches(/^[\w.-]+$/, {
    message: 'loginId must contain only letters, numbers, dot, hyphen, or underscore',
  })
  loginId: string;

  @IsString()
  @MinLength(1)
  password: string;
}
