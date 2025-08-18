import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { MulterExceptionFilter } from './filters/multer-exception.filter';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Global validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  // Handle Multer errors nicely
  app.useGlobalFilters(new MulterExceptionFilter());

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Desafio Bry - API')
    .setDescription(
      'Documentação da API para assinatura e verificação de arquivos (CMS/P7S) usando NestJS.',
    )
    .setVersion('1.0.0')
    .addTag('Crypto')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/json',
    customSiteTitle: 'Desafio Bry - Docs',
  });

  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
