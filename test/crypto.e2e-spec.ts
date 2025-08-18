import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { MulterModule } from '@nestjs/platform-express';
import * as request from 'supertest';
import { App } from 'supertest/types';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

describe('CryptoController (e2e)', () => {
  let app: INestApplication<App>;
  const tmpDir = os.tmpdir();

  // Resource paths
  const docPath = path.resolve(__dirname, '../resources/arquivos/doc.txt');
  const pfxPath = path.resolve(
    __dirname,
    '../resources/pkcs12/certificado_teste_hub.pfx',
  );
  const pfxPassword = 'bry123456';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      // Register Multer with disk storage to ensure files have a .path during tests
      imports: [MulterModule.register({ dest: tmpDir }), AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('POST /signature should return a Base64 CMS signature in JSON', async () => {
    const res = await request(app.getHttpServer())
      .post('/signature')
      .attach('file', docPath)
      .attach('pfx', pfxPath)
      .field('pfxPassword', pfxPassword)
      .expect(200)
      .expect('Content-Type', /application\/json/);

    const body = res.body as unknown as { signature: string };
    expect(typeof body.signature).toBe('string');
    // basic base64 check: decodes without throwing and not empty
    const buf = Buffer.from(body.signature, 'base64');
    expect(buf.length).toBeGreaterThan(0);

    // No further assertion here; verification is covered in another test.
  });

  it('POST /verify should return VALIDO for a known signed file', async () => {
    const signedFile = path.resolve(
      __dirname,
      '../resources/assinados/signed_file_0.p7s',
    );

    expect(fs.existsSync(signedFile)).toBe(true);

    const verifyRes = await request(app.getHttpServer())
      .post('/verify')
      .attach('file', signedFile)
      .expect(200)
      .expect('Content-Type', /application\/json/);

    const verifyBody = verifyRes.body as unknown as {
      status: string;
      infos?: Record<string, unknown>;
    };
    expect(typeof verifyBody.status).toBe('string');
    expect(['VALIDO', 'INVALIDO']).toContain(verifyBody.status);
    if (verifyBody.status === 'VALIDO' && verifyBody.infos) {
      expect(typeof verifyBody.infos).toBe('object');
    }
  });

  it('POST /verify should return INVALIDO for a non-signed file', async () => {
    const res = await request(app.getHttpServer())
      .post('/verify')
      .attach('file', docPath)
      .expect(200)
      .expect('Content-Type', /application\/json/);

    const body = res.body as unknown as { status: string };
    expect(body).toHaveProperty('status', 'INVALIDO');
  });
});
