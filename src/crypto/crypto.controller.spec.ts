import { Test, TestingModule } from '@nestjs/testing';
import { CryptoController } from './crypto.controller';
import { CryptoService } from './crypto.service';
import { BadRequestException } from '@nestjs/common';
import * as path from 'path';

describe('CryptoController', () => {
  let controller: CryptoController;
  const mockCryptoService = {
    signFileCMS: jest.fn(),
    verifySignature: jest.fn(),
  } as unknown as CryptoService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CryptoController],
      providers: [{ provide: CryptoService, useValue: mockCryptoService }],
    }).compile();

    controller = module.get<CryptoController>(CryptoController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('signFileCMS returns signature when files and password provided', async () => {
    const signature = 'dGVzdC1zaWduYXR1cmU='; // base64 stub
    const signFileSpy = jest
      .spyOn(mockCryptoService, 'signFileCMS')
      .mockResolvedValue(signature as never);
    const resourcesRoot = path.resolve(__dirname, '../../resources');
    const docPath = path.join(resourcesRoot, 'arquivos', 'doc.txt');
    const pfxPath = path.join(
      resourcesRoot,
      'pkcs12',
      'certificado_teste_hub.pfx',
    );

    const files: {
      file?: Express.Multer.File[];
      pfx?: Express.Multer.File[];
    } = {
      file: [{ path: docPath } as unknown as Express.Multer.File],
      pfx: [{ path: pfxPath } as unknown as Express.Multer.File],
    };

    const result = await controller.signFileCMS(files, 'pfx-pass');

    expect(result).toBe(signature);
    expect(signFileSpy).toHaveBeenCalledWith(docPath, pfxPath, 'pfx-pass');
  });

  it('signFileCMS throws BadRequestException when missing params', async () => {
    await expect(controller.signFileCMS({}, '')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('verifySignature forwards file path to service and returns result', async () => {
    const svcResult = { status: 'VALIDO', infos: { signerName: 'Tester' } };
    const verifySpy = jest
      .spyOn(mockCryptoService, 'verifySignature')
      .mockResolvedValue(svcResult as never);

    const resourcesRoot = path.resolve(__dirname, '../../resources');
    // Use an existing resource file to avoid requiring a pre-generated signed file
    const signedPath = path.join(resourcesRoot, 'arquivos', 'doc.txt');

    const file = { path: signedPath } as unknown as Express.Multer.File;

    const res = await controller.verifySignature(file);

    expect(res).toEqual(svcResult);
    expect(verifySpy).toHaveBeenCalledWith(signedPath);
  });
});
