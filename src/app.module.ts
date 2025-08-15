import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CryptoController } from './crypto/crypto.controller';
import { CryptoService } from './crypto/crypto.service';

@Module({
  imports: [],
  controllers: [AppController, CryptoController],
  providers: [AppService, CryptoService],
})
export class AppModule {}
