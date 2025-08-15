import * as forge from 'node-forge';
import * as fs from 'fs';
import * as path from 'path';

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
    type Bag = {
      bag: { key?: unknown; cert?: unknown } & Record<string, unknown>;
      friendlyName?: string;
      localKeyIdHex?: string;
      type?: string;
    };

    const keyBags: Bag[] = [];
    const certBags: Bag[] = [];

    p12.safeContents.forEach((safeContent: any) => {
      safeContent.safeBags.forEach((safeBag: any) => {
        const attrs =
          (safeBag.attributes as {
            friendlyName?: string[];
            localKeyId?: unknown[];
          }) || {};

        // friendlyName may appear as an array with first element a JS string
        const friendlyName = Array.isArray(attrs?.friendlyName)
          ? String(attrs!.friendlyName![0])
          : undefined;

        // localKeyId may be binary; try guarded conversions to a byte string
        let localKeyIdHex: string | undefined;
        const localKeyIdRaw = Array.isArray(attrs?.localKeyId)
          ? attrs.localKeyId[0]
          : undefined;
        if (localKeyIdRaw) {
          try {
            let bytes: string | undefined;
            if (typeof localKeyIdRaw === 'string') {
              bytes = localKeyIdRaw;
            } else if (Buffer.isBuffer(localKeyIdRaw)) {
              bytes = localKeyIdRaw.toString('binary');
            } else if (typeof (localKeyIdRaw as any).getBytes === 'function') {
              bytes = (localKeyIdRaw as any).getBytes();
            } else if (typeof (localKeyIdRaw as any).value === 'string') {
              bytes = (localKeyIdRaw as any).value as string;
            }

            if (bytes) {
              localKeyIdHex = forge.util.bytesToHex(bytes as string);
            }
          } catch {
            // ignore conversion errors and leave undefined
          }
        }

        const entry: Bag = {
          bag: safeBag,
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
      (entry && (entry.bag.key as unknown as forge.pki.PrivateKey)) ||
      undefined;
    const extractCertFrom = (entry?: Bag) =>
      (entry && (entry.bag.cert as unknown as forge.pki.Certificate)) ||
      undefined;

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
  ) {
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
    return Buffer.from(der, 'binary');
  }

  static saveFileToDisk(signedData: Buffer): string {
    //verify if folder exists
    const dir = path.resolve(__dirname, '../../resources/assinados');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const outputPath = path.resolve(
      __dirname,
      '../../resources/assinados/signed_file.p7s',
    );
    fs.writeFileSync(outputPath, signedData);
    return outputPath;
  }
}
