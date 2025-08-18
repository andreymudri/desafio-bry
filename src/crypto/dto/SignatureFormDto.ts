import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export default class SignatureFormDto {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Arquivo a ser assinado',
  })
  file!: any;

  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Arquivo PKCS#12 (PFX/P12) com a chave privada',
  })
  pfx!: any;

  @ApiProperty({
    description: 'Senha do arquivo PKCS#12 (PFX/P12)',
    minLength: 6,
  })
  @IsString()
  @MinLength(6)
  pfxPassword!: string;
}
