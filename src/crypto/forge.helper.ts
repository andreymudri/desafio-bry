/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import * as forge from 'node-forge';
import * as fs from 'fs';
import * as path from 'path';

interface SignedDataVerificationResult {
  valid: boolean;
  signerName?: string;
  signingTime?: string;
  documentHashHex?: string;
  digestAlgorithmName?: string;
}

export default class ForgeHelper {
  static loadCertificate(
    pfxPath: string,
    alias: string,
    pfxPassword: string,
  ): { key: forge.pki.PrivateKey; cert: forge.pki.Certificate } {
    const pfxBuffer = fs.readFileSync(pfxPath);
    const p12Asn1 = forge.asn1.fromDer(pfxBuffer.toString('binary'));
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, false, pfxPassword);

    // Collect key and cert bags with metadata for robust matching
    // Local mapped type alias used to express that the bag object
    // also behaves like a string-indexed record (works around external lib types)
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

        // friendlyName may appear as an array with first element a JS string
        const friendlyName = Array.isArray(attrs.friendlyName)
          ? String(attrs.friendlyName[0])
          : undefined;

        // localKeyId may be binary; try guarded conversions to a byte string
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
            // ignore conversion errors and leave undefined
          }
        }

        const entry: Bag = {
          // safeBag comes from the external forge types and doesn't include a
          // string index signature; cast to BagMap locally so it is treated
          // as a Record<string, unknown> where needed (non-invasive)
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

    // 1) Try to find by friendlyName matching alias
    let matchedKeyEntry = keyBags.find((k) => k.friendlyName === alias);
    let matchedCertEntry = certBags.find((c) => c.friendlyName === alias);

    // 2) If not found, try matching by localKeyId (hex)
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

    // 3) If still not found, but there's exactly one key and one cert, use them (convenience)
    if (
      (!matchedKeyEntry || !matchedCertEntry) &&
      keyBags.length === 1 &&
      certBags.length === 1
    ) {
      matchedKeyEntry = matchedKeyEntry || keyBags[0];
      matchedCertEntry = matchedCertEntry || certBags[0];
    }

    // 4) Finalize
    const privateKey = extractKeyFrom(matchedKeyEntry);
    const certificate = extractCertFrom(matchedCertEntry);

    if (!privateKey || !certificate) {
      // Build helpful diagnostics listing available friendly names
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

      throw new Error(
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
    // Return Base64 string for interoperability
    const buf = Buffer.from(der, 'binary');
    return buf.toString('base64');
  }

  static verifySignedData(signedBuffer: Buffer): SignedDataVerificationResult {
    try {
      const binary = signedBuffer.toString('binary');
      const asn1 = forge.asn1.fromDer(binary);
      // forge types are imprecise here; cast to any for runtime access
      const p7: any = forge.pkcs7.messageFromAsn1(asn1);

      // Try to verify signatures (will return boolean)
      let valid = false;
      try {
        if (typeof p7.verify === 'function') {
          valid = p7.verify();
        }
      } catch {
        return { valid: false };
      }

      // Extract first signer and certificate if present
      const signer = p7.signers && p7.signers[0];
      const cert = p7.certificates && p7.certificates[0];

      // signerName from certificate CN
      let signerName: string | undefined;
      try {
        if (cert && cert.subject) {
          // cert.subject.getField may exist in forge cert
          const field =
            (cert.subject &&
              cert.subject.getField &&
              cert.subject.getField('CN')) ||
            // or subject.attributes array
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

      // signingTime and messageDigest from authenticatedAttributes
      let signingTime: string | undefined;
      let documentHashHex: string | undefined;
      let digestAlgorithmName: string | undefined;

      if (signer) {
        // digest algorithm OID may be on signer.digestAlgorithm
        try {
          const oid = signer.digestAlgorithm || signer.digestAlgorithmOid;
          if (oid) {
            // map common OIDs
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
                documentHashHex = forge.util.bytesToHex(mv.getBytes());
              } else if (Buffer.isBuffer(mv)) {
                documentHashHex = Buffer.from(mv).toString('hex');
              }
            }
          } catch {
            // ignore attribute parsing errors
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

  static saveFileToDisk(signedData: Buffer | string, index = 0): string {
    //verify if folder exists
    const dir = path.resolve(__dirname, '../../resources/assinados');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const outputPath = path.resolve(
      __dirname,
      `../../resources/assinados/signed_file_${index}.p7s`,
    );

    if (fs.existsSync(outputPath)) {
      return this.saveFileToDisk(signedData, index + 1);
    }
    // If signedData is Base64 string, decode to binary before writing
    if (typeof signedData === 'string') {
      fs.writeFileSync(outputPath, Buffer.from(signedData, 'base64'));
    } else {
      fs.writeFileSync(outputPath, signedData);
    }
    return outputPath;
  }
}
