/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as forge from 'node-forge';
import * as fs from 'fs';
import * as path from 'path';

// Erros de domínio para classificar falhas de PKCS#12/forge
export class Pkcs12InvalidPasswordError extends Error {
  constructor(message = 'INVALID_PFX_PASSWORD') {
    super(message);
    this.name = 'Pkcs12InvalidPasswordError';
  }
}

export class Pkcs12CorruptedError extends Error {
  constructor(message = 'PFX_CORRUPTED') {
    super(message);
    this.name = 'Pkcs12CorruptedError';
  }
}

export class Pkcs12AliasNotFoundError extends Error {
  constructor(message = 'ALIAS_NOT_FOUND') {
    super(message);
    this.name = 'Pkcs12AliasNotFoundError';
  }
}

interface SignedDataVerificationResult {
  valid: boolean;
  signerName?: string;
  signingTime?: string;
  documentHashHex?: string;
  digestAlgorithmName?: string;
}

export default class ForgeHelper {
  static async loadCertificate(
    pfxPath: string,
    alias: string,
    pfxPassword: string,
  ): Promise<{ key: forge.pki.PrivateKey; cert: forge.pki.Certificate }> {
    let pfxBuffer: Buffer;
    try {
      pfxBuffer = await fs.promises.readFile(pfxPath);
    } catch {
      // Trata arquivo ilegível como corrompido/entrada inválida
      throw new Pkcs12CorruptedError('PFX file not readable');
    }

    let p12Asn1: forge.asn1.Asn1;
    try {
      p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    } catch {
      // Falha ao interpretar DER
      throw new Pkcs12CorruptedError('Invalid DER structure');
    }

    let p12: forge.pkcs12.Pkcs12Pfx;
    try {
      p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pfxPassword);
    } catch (err: any) {
      const msg = String(err?.message || err || '').toLowerCase();
      // Mensagens típicas do node-forge em caso de senha/MAC inválidos
      if (
        msg.includes('mac') ||
        msg.includes('invalid password') ||
        msg.includes('pbe') ||
        msg.includes('decrypt')
      ) {
        throw new Pkcs12InvalidPasswordError();
      }
      throw new Pkcs12CorruptedError('Unable to parse PKCS#12');
    }

    // Coleta bolsas de chave e certificado com metadados para casamento robusto
    // Alias de tipo mapeado local para expressar que o objeto "bag"
    // também se comporta como um Record indexado por string (contorna tipos da lib externa)
    type BagMap = { key?: unknown; cert?: unknown } & Record<string, unknown>;

    type Bag = {
      bag: BagMap;
      friendlyName?: string;
      localKeyIdHex?: string;
      type?: string;
    };

    const keyBags: Bag[] = [];
    const certBags: Bag[] = [];

    p12.safeContents.forEach((safeContent) => {
      safeContent.safeBags.forEach((safeBag) => {
        const attrs =
          (safeBag.attributes as {
            friendlyName?: string[];
            localKeyId?: unknown[];
          }) || {};

        // friendlyName pode aparecer como array com primeiro elemento string
        const friendlyName = Array.isArray(attrs.friendlyName)
          ? String(attrs.friendlyName[0])
          : undefined;

        // localKeyId pode ser binário; tenta conversões protegidas para bytes
        let localKeyIdHex: string | undefined;
        const localKeyIdRaw = Array.isArray(attrs.localKeyId)
          ? attrs.localKeyId[0]
          : undefined;
        if (localKeyIdRaw) {
          try {
            let bytes: string | undefined;
            if (typeof localKeyIdRaw === 'string') {
              bytes = localKeyIdRaw;
            } else if (Buffer.isBuffer(localKeyIdRaw)) {
              bytes = localKeyIdRaw.toString('binary');
            } else if (
              typeof (localKeyIdRaw as { getBytes?: unknown })?.getBytes ===
              'function'
            ) {
              bytes = (localKeyIdRaw as { getBytes: () => string }).getBytes();
            } else if (
              typeof (localKeyIdRaw as { value?: unknown })?.value === 'string'
            ) {
              bytes = (localKeyIdRaw as { value: string }).value;
            }

            if (bytes) {
              localKeyIdHex = forge.util.bytesToHex(bytes);
            }
          } catch {
            // ignora erros de conversão e mantém undefined
          }
        }

        const entry: Bag = {
          // safeBag vem de tipos externos do forge e não inclui assinatura de índice string;
          // faz cast para BagMap localmente para que seja tratado como Record<string, unknown>
          // onde necessário (abordagem não invasiva)
          bag: safeBag as unknown as BagMap,
          friendlyName,
          localKeyIdHex,
          type: safeBag.type,
        };

        if (safeBag.type === forge.pki.oids.pkcs8ShroudedKeyBag) {
          keyBags.push(entry);
        } else if (safeBag.type === forge.pki.oids.certBag) {
          certBags.push(entry);
        }
      });
    });

    const extractKeyFrom = (entry?: Bag) =>
      (entry && (entry.bag.key as forge.pki.PrivateKey)) || undefined;
    const extractCertFrom = (entry?: Bag) =>
      (entry && (entry.bag.cert as forge.pki.Certificate)) || undefined;

    // 1) Tenta encontrar por friendlyName combinando com o alias
    let matchedKeyEntry = keyBags.find((k) => k.friendlyName === alias);
    let matchedCertEntry = certBags.find((c) => c.friendlyName === alias);

    // 2) Se não encontrar, tenta encontrar por localKeyId (hex)
    if (!matchedKeyEntry || !matchedCertEntry) {
      for (const k of keyBags) {
        if (!k.localKeyIdHex) continue;
        const matchCert = certBags.find(
          (c) => c.localKeyIdHex === k.localKeyIdHex,
        );
        if (matchCert) {
          matchedKeyEntry = matchedKeyEntry || k;
          matchedCertEntry = matchedCertEntry || matchCert;
          break;
        }
      }
    }

    // 3) Ainda não encontrou? Se houver exatamente uma chave e um certificado, será utilizado esta chave e cert por conveniência
    if (
      (!matchedKeyEntry || !matchedCertEntry) &&
      keyBags.length === 1 &&
      certBags.length === 1
    ) {
      matchedKeyEntry = matchedKeyEntry || keyBags[0];
      matchedCertEntry = matchedCertEntry || certBags[0];
    }

    // 4) Finaliza
    const privateKey = extractKeyFrom(matchedKeyEntry);
    const certificate = extractCertFrom(matchedCertEntry);

    if (!privateKey || !certificate) {
      // Constrói diagnóstico listando friendlyNames disponíveis
      const availableFriendly = Array.from(
        new Set([
          ...keyBags.map((k) => k.friendlyName).filter(Boolean),
          ...certBags.map((c) => c.friendlyName).filter(Boolean),
        ]),
      ) as string[];

      const availableLocalKeyIds = Array.from(
        new Set([
          ...keyBags.map((k) => k.localKeyIdHex).filter(Boolean),
          ...certBags.map((c) => c.localKeyIdHex).filter(Boolean),
        ]),
      ) as string[];

      const availMsgParts: string[] = [];
      if (availableFriendly.length)
        availMsgParts.push(`friendlyNames=${availableFriendly.join(',')}`);
      if (availableLocalKeyIds.length)
        availMsgParts.push(`localKeyIds=${availableLocalKeyIds.join(',')}`);

      const availMsg = availMsgParts.length
        ? ` (available: ${availMsgParts.join('; ')})`
        : '';

      throw new Pkcs12AliasNotFoundError(
        `Failed to find key and certificate for alias: ${alias}${availMsg}`,
      );
    }

    return { key: privateKey, cert: certificate };
  }

  static signData(
    data: Buffer,
    key: forge.pki.PrivateKey,
    cert: forge.pki.Certificate,
  ): string {
    const p7 = forge.pkcs7.createSignedData();

    // Conteúdo anexado (usar representação binária)
    const fileBinary = data.toString('binary');
    p7.content = forge.util.createBuffer(fileBinary);
    p7.addCertificate(cert);

    p7.addSigner({
      key: key as unknown as forge.pki.rsa.PrivateKey | string,
      certificate: cert,
      digestAlgorithm: forge.pki.oids.sha512,
      authenticatedAttributes: [
        {
          type: forge.pki.oids.contentType,
          value: forge.pki.oids.data,
        },
        { type: forge.pki.oids.messageDigest },
        { type: forge.pki.oids.signingTime },
      ],
    });

    p7.sign({ detached: false });

    const asn1 = p7.toAsn1();
    const der = forge.asn1.toDer(asn1).getBytes();
    // Retorna string Base64 para interoperabilidade
    const buf = Buffer.from(der, 'binary');
    return buf.toString('base64');
  }

  static verifySignedData(signedBuffer: Buffer): SignedDataVerificationResult {
    try {
      const binary = signedBuffer.toString('binary');
      const asn1 = forge.asn1.fromDer(binary);
      // Tipos do forge são imprecisos. usa any no acesso
      const p7: any = forge.pkcs7.messageFromAsn1(asn1);

      // Tenta verificar as assinaturas (retorna um booleano)
      let valid = false;
      try {
        if (typeof p7.verify === 'function') {
          valid = p7.verify();
        }
      } catch {
        return { valid: false };
      }

      // Extrai o primeiro signatário e certificado, se presentes
      const signer = p7.signers && p7.signers[0];
      const cert = p7.certificates && p7.certificates[0];

      // signerName a partir do CN do certificado
      let signerName: string | undefined;
      try {
        if (cert && cert.subject) {
          // cert.subject.getField pode existir no certificado do forge
          const field =
            (cert.subject &&
              cert.subject.getField &&
              cert.subject.getField('CN')) ||
            // ou no array subject.attributes
            (Array.isArray(cert.subject?.attributes) &&
              cert.subject.attributes.find(
                (a: any) => a && a.name === 'commonName',
              ));
          const val =
            field &&
            (field.value || field.value === 0 ? field.value : field.commonName);
          if (val) signerName = String(val);
        }
      } catch {
        signerName = undefined;
      }

      // signingTime e messageDigest a partir de authenticatedAttributes
      let signingTime: string | undefined;
      let documentHashHex: string | undefined;
      let digestAlgorithmName: string | undefined;

      if (signer) {
        // OID do algoritmo de digest pode estar em signer.digestAlgorithm
        try {
          const oid = signer.digestAlgorithm || signer.digestAlgorithmOid;
          if (oid) {
            // mapeia OIDs comuns
            const map: Record<string, string> = {
              [forge.pki.oids.sha1]: 'SHA-1',
              [forge.pki.oids.sha256]: 'SHA-256',
              [forge.pki.oids.sha384]: 'SHA-384',
              [forge.pki.oids.sha512]: 'SHA-512',
            };
            digestAlgorithmName = map[oid] || String(oid);
          }
        } catch {
          /* ignore */
        }

        const attrs: any[] =
          signer.authenticatedAttributes || signer.authAttrs || [];
        for (const a of attrs) {
          try {
            const type = a && (a.type || a.typeOid || a.attrType);
            const value = a && (a.value || a.attrValues || a.values);

            if (type === forge.pki.oids.signingTime && value) {
              const v = Array.isArray(value) ? value[0] : value;
              if (v instanceof Date) signingTime = v.toISOString();
              else if (typeof v === 'string') signingTime = v;
              else if (v && typeof v === 'object' && v.toISOString)
                signingTime = v.toISOString();
            }

            if (type === forge.pki.oids.messageDigest && value) {
              const mv = Array.isArray(value) ? value[0] : value;
              if (typeof mv === 'string') {
                documentHashHex = forge.util.bytesToHex(mv);
              } else if (mv && typeof mv === 'object' && mv.getBytes) {
                documentHashHex = forge.util.bytesToHex(
                  (mv as { getBytes: () => string }).getBytes(),
                );
              } else if (Buffer.isBuffer(mv)) {
                documentHashHex = Buffer.from(mv).toString('hex');
              }
            }
          } catch {
            // ignora erros na interpretação de atributos
          }
        }
      }

      return {
        valid,
        signerName,
        signingTime,
        documentHashHex,
        digestAlgorithmName,
      };
    } catch {
      return { valid: false };
    }
  }

  static async saveFileToDisk(
    signedData: Buffer | string,
    index = 0,
  ): Promise<string> {
    const dir = path.resolve(__dirname, '../../resources/assinados');
    await fs.promises.mkdir(dir, { recursive: true });

    // Encontra o próximo nome de arquivo disponível sem recursão
    let outputPath: string;
    let i = index;
    while (true) {
      outputPath = path.resolve(
        __dirname,
        `../../resources/assinados/signed_file_${i}.p7s`,
      );
      try {
        await fs.promises.access(outputPath, fs.constants.F_OK);
        // existe, tenta o próximo
        i += 1;
      } catch {
        // não existe, podemos usar
        break;
      }
    }

    const bytes =
      typeof signedData === 'string'
        ? Buffer.from(signedData, 'base64')
        : signedData;
    await fs.promises.writeFile(outputPath, bytes);
    return outputPath;
  }
}
