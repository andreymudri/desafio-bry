import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export default class SignRequestDto {
  @ApiProperty({
    description: 'Senha do arquivo PKCS#12 (PFX/P12)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  pfxPassword!: string;
}
