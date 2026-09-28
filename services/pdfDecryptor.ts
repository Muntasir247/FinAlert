/**
 * PDF Decryption Service for FinAlert
 * Full support for:
 *   - AES-128 (V=4, R=4) per ISO 32000-1:2008 (standard for Bangladeshi & international bank statements)
 *   - AES-256 (V=5, R=6) per ISO 32000-2:2020
 *   - RC4 40-bit / 128-bit (V=1-2, R=2-3) per ISO 32000-1:2008
 */

// @ts-ignore
import forge from 'node-forge';
import {
  PDFDocument,
  PDFName,
  PDFHexString,
  PDFString,
  PDFDict,
  PDFArray,
  PDFRawStream,
  PDFRef,
} from 'pdf-lib';
import { decryptPDF as decryptWithPdfSmaller } from '@pdfsmaller/pdf-decrypt';

// Standard 32-byte PDF padding string (ISO 32000-1)
const PADDING = new Uint8Array([
  0x28, 0xbf, 0x4e, 0x5e, 0x4e, 0x75, 0x8a, 0x41,
  0x64, 0x00, 0x4e, 0x56, 0xff, 0xfa, 0x01, 0x08,
  0x2e, 0x2e, 0x00, 0xb6, 0xd0, 0x68, 0x3e, 0x80,
  0x2f, 0x0c, 0xa9, 0xfe, 0x64, 0x53, 0x69, 0x7a,
]);

// ── Binary Conversion Helpers ────────────────────────────────────────────────

function uint8ArrayToBinaryString(u8: Uint8Array): string {
  let str = '';
  const CHUNK = 8192;
  for (let i = 0; i < u8.length; i += CHUNK) {
    const slice = u8.subarray(i, i + CHUNK);
    str += String.fromCharCode.apply(null, Array.from(slice));
  }
  return str;
}

function binaryStringToUint8Array(str: string): Uint8Array {
  const u8 = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i++) {
    u8[i] = str.charCodeAt(i) & 0xff;
  }
  return u8;
}

function hexToBytes(hex: string): Uint8Array {
  const cleanHex = hex.replace(/[^0-9a-fA-F]/g, '');
  const bytes = new Uint8Array(Math.floor(cleanHex.length / 2));
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(cleanHex.substr(i * 2, 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = '';
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, '0');
  }
  return hex;
}

function extractBytes(pdfObj: unknown): Uint8Array | null {
  if (!pdfObj) return null;
  if (pdfObj instanceof PDFHexString) {
    return hexToBytes(pdfObj.asString());
  }
  if (pdfObj instanceof PDFString) {
    return pdfObj.asBytes();
  }
  const str = String(pdfObj);
  if (str.startsWith('<') && str.endsWith('>')) {
    return hexToBytes(str.slice(1, -1));
  }
  return null;
}

function arraysEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

// ── Native MD5 Implementation (Uint8Array) ───────────────────────────────────

function md5(data: Uint8Array | string): Uint8Array {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : data;
  const S = [
    7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
    5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
    4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
    6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
  ];
  const K = new Uint32Array([
    0xd76aa478, 0xe8c7b756, 0x242070db, 0xc1bdceee,
    0xf57c0faf, 0x4787c62a, 0xa8304613, 0xfd469501,
    0x698098d8, 0x8b44f7af, 0xffff5bb1, 0x895cd7be,
    0x6b901122, 0xfd987193, 0xa679438e, 0x49b40821,
    0xf61e2562, 0xc040b340, 0x265e5a51, 0xe9b6c7aa,
    0xd62f105d, 0x02441453, 0xd8a1e681, 0xe7d3fbc8,
    0x21e1cde6, 0xc33707d6, 0xf4d50d87, 0x455a14ed,
    0xa9e3e905, 0xfcefa3f8, 0x676f02d9, 0x8d2a4c8a,
    0xfffa3942, 0x8771f681, 0x6d9d6122, 0xfde5380c,
    0xa4beea44, 0x4bdecfa9, 0xf6bb4b60, 0xbebfbc70,
    0x289b7ec6, 0xeaa127fa, 0xd4ef3085, 0x04881d05,
    0xd9d4d039, 0xe6db99e5, 0x1fa27cf8, 0xc4ac5665,
    0xf4292244, 0x432aff97, 0xab9423a7, 0xfc93a039,
    0x655b59c3, 0x8f0ccc92, 0xffeff47d, 0x85845dd1,
    0x6fa87e4f, 0xfe2ce6e0, 0xa3014314, 0x4e0811a1,
    0xf7537e82, 0xbd3af235, 0x2ad7d2bb, 0xeb86d391,
  ]);

  let a0 = 0x67452301;
  let b0 = 0xefcdab89;
  let c0 = 0x98badcfe;
  let d0 = 0x10325476;

  const msgLen = bytes.length;
  const msgBitLen = msgLen * 8;
  const msgLenPadded = (msgLen + 9 + 63) & ~63;
  const msg = new Uint8Array(msgLenPadded);
  msg.set(bytes);
  msg[msgLen] = 0x80;

  const dataView = new DataView(msg.buffer, msg.byteOffset, msg.byteLength);
  dataView.setUint32(msgLenPadded - 8, msgBitLen, true);
  dataView.setUint32(msgLenPadded - 4, 0, true);

  for (let offset = 0; offset < msgLenPadded; offset += 64) {
    const chunk = new Uint32Array(msg.buffer, msg.byteOffset + offset, 16);
    let a = a0;
    let b = b0;
    let c = c0;
    let d = d0;
    for (let i = 0; i < 64; i++) {
      let f: number, g: number;
      if (i < 16) {
        f = (b & c) | (~b & d);
        g = i;
      } else if (i < 32) {
        f = (d & b) | (~d & c);
        g = (5 * i + 1) % 16;
      } else if (i < 48) {
        f = b ^ c ^ d;
        g = (3 * i + 5) % 16;
      } else {
        f = c ^ (b | ~d);
        g = (7 * i) % 16;
      }
      f = (f + a + K[i] + chunk[g]) >>> 0;
      a = d;
      d = c;
      c = b;
      b = (b + ((f << S[i]) | (f >>> (32 - S[i])))) >>> 0;
    }
    a0 = (a0 + a) >>> 0;
    b0 = (b0 + b) >>> 0;
    c0 = (c0 + c) >>> 0;
    d0 = (d0 + d) >>> 0;
  }

  const result = new Uint8Array(16);
  const resView = new DataView(result.buffer);
  resView.setUint32(0, a0, true);
  resView.setUint32(4, b0, true);
  resView.setUint32(8, c0, true);
  resView.setUint32(12, d0, true);
  return result;
}

// ── Native RC4 Implementation ────────────────────────────────────────────────

class RC4 {
  private s = new Uint8Array(256);
  private i = 0;
  private j = 0;

  constructor(key: Uint8Array) {
    for (let k = 0; k < 256; k++) this.s[k] = k;
    let j = 0;
    for (let k = 0; k < 256; k++) {
      j = (j + this.s[k] + key[k % key.length]) & 255;
      const tmp = this.s[k];
      this.s[k] = this.s[j];
      this.s[j] = tmp;
    }
  }

  process(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(data.length);
    for (let k = 0; k < data.length; k++) {
      this.i = (this.i + 1) & 255;
      this.j = (this.j + this.s[this.i]) & 255;
      const tmp = this.s[this.i];
      this.s[this.i] = this.s[this.j];
      this.s[this.j] = tmp;
      out[k] = data[k] ^ this.s[(this.s[this.i] + this.s[this.j]) & 255];
    }
    return out;
  }
}

// ── AES-128-CBC Decryption ───────────────────────────────────────────────────

async function aes128CbcDecrypt(ciphertext: Uint8Array, key: Uint8Array, iv: Uint8Array): Promise<Uint8Array> {
  // 1. Try Web Crypto API first (standard in Expo & modern engines)
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        key as unknown as BufferSource,
        'AES-CBC',
        false,
        ['decrypt']
      );
      const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-CBC', iv: iv as unknown as BufferSource },
        cryptoKey,
        ciphertext as unknown as BufferSource
      );
      return new Uint8Array(decrypted);
    } catch {
      // Fall through to forge on any Web Crypto padding/platform failure
    }
  }

  // 2. Pure JS fallback via node-forge
  try {
    const decipher = forge.cipher.createDecipher(
      'AES-CBC',
      forge.util.createBuffer(uint8ArrayToBinaryString(key))
    );
    decipher.start({ iv: forge.util.createBuffer(uint8ArrayToBinaryString(iv)) });
    decipher.update(forge.util.createBuffer(uint8ArrayToBinaryString(ciphertext)));
    const ok = decipher.finish();
    if (!ok) {
      return ciphertext;
    }
    return binaryStringToUint8Array(decipher.output.getBytes());
  } catch {
    return ciphertext;
  }
}

// ── Password Padding & Encryption Key Derivation (Algorithms 2 & 6) ──────────

function padPassword(password: string): Uint8Array {
  const pwdBytes = new TextEncoder().encode(password);
  const padded = new Uint8Array(32);
  if (pwdBytes.length >= 32) {
    padded.set(pwdBytes.slice(0, 32));
  } else {
    padded.set(pwdBytes);
    padded.set(PADDING.slice(0, 32 - pwdBytes.length), pwdBytes.length);
  }
  return padded;
}

function computeEncryptionKey(
  password: string,
  ownerKey: Uint8Array,
  permissions: number,
  fileId: Uint8Array,
  revision: number,
  keyLength: number,
  encryptMetadata = true
): Uint8Array {
  const paddedPwd = padPassword(password);
  const extraLen = !encryptMetadata && revision >= 4 ? 4 : 0;
  const hashInput = new Uint8Array(
    paddedPwd.length + ownerKey.length + 4 + fileId.length + extraLen
  );

  let offset = 0;
  hashInput.set(paddedPwd, offset);
  offset += paddedPwd.length;

  hashInput.set(ownerKey, offset);
  offset += ownerKey.length;

  hashInput[offset++] = permissions & 0xff;
  hashInput[offset++] = (permissions >> 8) & 0xff;
  hashInput[offset++] = (permissions >> 16) & 0xff;
  hashInput[offset++] = (permissions >> 24) & 0xff;

  hashInput.set(fileId, offset);
  offset += fileId.length;

  if (extraLen > 0) {
    hashInput[offset++] = 0xff;
    hashInput[offset++] = 0xff;
    hashInput[offset++] = 0xff;
    hashInput[offset++] = 0xff;
  }

  let hash = md5(hashInput);

  if (revision >= 3) {
    const n = keyLength;
    for (let i = 0; i < 50; i++) {
      hash = md5(hash.slice(0, n));
    }
  }

  return hash.slice(0, keyLength);
}

interface EncryptParamsV4 {
  version: number;
  revision: number;
  ownerKey: Uint8Array;
  userKey: Uint8Array;
  permissions: number;
  fileId: Uint8Array;
  keyLength: number;
  encryptMetadata: boolean;
  algorithm: 'AES-128' | 'RC4';
  encryptRef: PDFRef | PDFDict | null;
}

function validateUserPassword(password: string, params: EncryptParamsV4): Uint8Array | null {
  const { ownerKey, userKey, permissions, fileId, revision, keyLength, encryptMetadata } = params;
  const encryptionKey = computeEncryptionKey(
    password,
    ownerKey,
    permissions,
    fileId,
    revision,
    keyLength,
    encryptMetadata
  );

  if (revision === 2) {
    const rc4 = new RC4(encryptionKey);
    const computed = rc4.process(new Uint8Array(PADDING));
    if (arraysEqual(computed, userKey)) {
      return encryptionKey;
    }
  } else {
    // Rev 3 & 4 (Algorithm 6)
    const hashInput = new Uint8Array(PADDING.length + fileId.length);
    hashInput.set(PADDING);
    hashInput.set(fileId, PADDING.length);
    const hash = md5(hashInput);

    let result = new RC4(encryptionKey).process(hash);
    for (let i = 1; i <= 19; i++) {
      const iterKey = new Uint8Array(encryptionKey.length);
      for (let j = 0; j < encryptionKey.length; j++) {
        iterKey[j] = encryptionKey[j] ^ i;
      }
      result = new RC4(iterKey).process(result);
    }

    if (arraysEqual(result.slice(0, 16), userKey.slice(0, 16))) {
      return encryptionKey;
    }
  }

  return null;
}

function validateOwnerPassword(ownerPassword: string, params: EncryptParamsV4): Uint8Array | null {
  const { ownerKey, revision, keyLength } = params;
  const paddedOwner = padPassword(ownerPassword);
  let hash = md5(paddedOwner);

  if (revision >= 3) {
    for (let i = 0; i < 50; i++) {
      hash = md5(hash);
    }
  }

  const ownerDecryptKey = hash.slice(0, keyLength);
  let recoveredUserPwd: any;

  if (revision === 2) {
    const rc4 = new RC4(ownerDecryptKey);
    recoveredUserPwd = rc4.process(new Uint8Array(ownerKey));
  } else {
    let result: any = new Uint8Array(ownerKey);
    for (let i = 19; i >= 0; i--) {
      const iterKey = new Uint8Array(ownerDecryptKey.length);
      for (let j = 0; j < ownerDecryptKey.length; j++) {
        iterKey[j] = ownerDecryptKey[j] ^ i;
      }
      result = new RC4(iterKey).process(result);
    }
    recoveredUserPwd = result;
  }

  let recoveredPasswordStr = '';
  for (let i = 0; i < recoveredUserPwd.length; i++) {
    if (recoveredUserPwd[i] === 0) break;
    recoveredPasswordStr += String.fromCharCode(recoveredUserPwd[i]);
  }

  return validateUserPassword(recoveredPasswordStr, params);
}

// ── Object Key Derivation & Decryption ───────────────────────────────────────

function deriveObjectKeyAES128(encryptionKey: Uint8Array, objectNum: number, generationNum: number): Uint8Array {
  const keyInput = new Uint8Array(encryptionKey.length + 9);
  keyInput.set(encryptionKey);
  keyInput[encryptionKey.length] = objectNum & 0xff;
  keyInput[encryptionKey.length + 1] = (objectNum >> 8) & 0xff;
  keyInput[encryptionKey.length + 2] = (objectNum >> 16) & 0xff;
  keyInput[encryptionKey.length + 3] = generationNum & 0xff;
  keyInput[encryptionKey.length + 4] = (generationNum >> 8) & 0xff;
  // Constant "sAlT" per ISO 32000-1 (Section 7.6.2)
  keyInput[encryptionKey.length + 5] = 0x73;
  keyInput[encryptionKey.length + 6] = 0x41;
  keyInput[encryptionKey.length + 7] = 0x6c;
  keyInput[encryptionKey.length + 8] = 0x54;

  return md5(keyInput).slice(0, 16);
}

function deriveObjectKeyRC4(encryptionKey: Uint8Array, objectNum: number, generationNum: number): Uint8Array {
  const keyInput = new Uint8Array(encryptionKey.length + 5);
  keyInput.set(encryptionKey);
  keyInput[encryptionKey.length] = objectNum & 0xff;
  keyInput[encryptionKey.length + 1] = (objectNum >> 8) & 0xff;
  keyInput[encryptionKey.length + 2] = (objectNum >> 16) & 0xff;
  keyInput[encryptionKey.length + 3] = generationNum & 0xff;
  keyInput[encryptionKey.length + 4] = (generationNum >> 8) & 0xff;

  return md5(keyInput).slice(0, Math.min(encryptionKey.length + 5, 16));
}

async function decryptDataAES128(
  data: Uint8Array,
  objectNum: number,
  generationNum: number,
  encryptionKey: Uint8Array
): Promise<Uint8Array> {
  if (!data || data.length < 16) return data;
  const objectKey = deriveObjectKeyAES128(encryptionKey, objectNum, generationNum);
  const iv = data.slice(0, 16);
  const ciphertext = data.slice(16);
  if (ciphertext.length === 0) return new Uint8Array(0);
  if (ciphertext.length % 16 !== 0) return data;
  return await aes128CbcDecrypt(ciphertext, objectKey, iv);
}

function decryptDataRC4(
  data: Uint8Array,
  objectNum: number,
  generationNum: number,
  encryptionKey: Uint8Array
): Uint8Array {
  const objectKey = deriveObjectKeyRC4(encryptionKey, objectNum, generationNum);
  const rc4 = new RC4(objectKey);
  return rc4.process(data);
}

async function decryptStringsRecursively(
  obj: unknown,
  objectNum: number,
  generationNum: number,
  encryptionKey: Uint8Array,
  isAES: boolean
): Promise<void> {
  if (!obj) return;

  if (obj instanceof PDFString) {
    const originalBytes = obj.asBytes();
    if (originalBytes.length > 0) {
      const decrypted = isAES
        ? await decryptDataAES128(originalBytes, objectNum, generationNum, encryptionKey)
        : decryptDataRC4(originalBytes, objectNum, generationNum, encryptionKey);
      (obj as any).value = Array.from(decrypted)
        .map((b) => String.fromCharCode(b))
        .join('');
    }
  } else if (obj instanceof PDFHexString) {
    const originalBytes = obj.asBytes();
    if (originalBytes.length > 0) {
      const decrypted = isAES
        ? await decryptDataAES128(originalBytes, objectNum, generationNum, encryptionKey)
        : decryptDataRC4(originalBytes, objectNum, generationNum, encryptionKey);
      (obj as any).value = bytesToHex(decrypted);
    }
  } else if (obj instanceof PDFDict) {
    for (const [key, value] of obj.entries()) {
      const keyName = key.asString();
      if (keyName !== '/Length' && keyName !== '/Filter' && keyName !== '/DecodeParms') {
        await decryptStringsRecursively(value, objectNum, generationNum, encryptionKey, isAES);
      }
    }
  } else if (obj instanceof PDFArray) {
    for (const element of obj.asArray()) {
      await decryptStringsRecursively(element, objectNum, generationNum, encryptionKey, isAES);
    }
  }
}

// ── V=4, R=4 Document Decryption ─────────────────────────────────────────────

async function decryptDocumentV4R4(
  pdfDoc: PDFDocument,
  params: EncryptParamsV4,
  password: string
): Promise<Uint8Array> {
  let encryptionKey = validateUserPassword(password, params);
  if (!encryptionKey) {
    encryptionKey = validateOwnerPassword(password, params);
  }

  if (!encryptionKey) {
    throw new Error('INCORRECT_PASSWORD');
  }

  const isAES = params.algorithm === 'AES-128';
  const context = pdfDoc.context;
  const encryptRefNum =
    params.encryptRef instanceof PDFRef ? params.encryptRef.objectNumber : null;

  const indirectObjects = context.enumerateIndirectObjects();
  for (const [ref, obj] of indirectObjects) {
    const objectNum = ref.objectNumber;
    const generationNum = ref.generationNumber || 0;

    if (encryptRefNum !== null && objectNum === encryptRefNum) continue;

    if (obj instanceof PDFDict && !(obj instanceof PDFRawStream)) {
      const type = obj.get(PDFName.of('Type'));
      if (type && type.toString() === '/Sig') continue;
    }

    if (obj instanceof PDFRawStream && obj.dict) {
      const type = obj.dict.get(PDFName.of('Type'));
      if (type) {
        const typeName = type.toString();
        if (typeName === '/XRef' || typeName === '/Sig') continue;
        if (typeName === '/Metadata' && !params.encryptMetadata) continue;
      }
    }

    if (obj instanceof PDFRawStream) {
      const streamData = obj.contents;
      const decrypted = isAES
        ? await decryptDataAES128(streamData, objectNum, generationNum, encryptionKey)
        : decryptDataRC4(streamData, objectNum, generationNum, encryptionKey);
      (obj as any).contents = decrypted;

      if (obj.dict) {
        await decryptStringsRecursively(obj.dict, objectNum, generationNum, encryptionKey, isAES);
      }
    }

    if (!(obj instanceof PDFRawStream)) {
      await decryptStringsRecursively(obj, objectNum, generationNum, encryptionKey, isAES);
    }
  }

  // Remove the /Encrypt dictionary from trailer
  delete (context.trailerInfo as { Encrypt?: unknown }).Encrypt;

  return await pdfDoc.save({ useObjectStreams: false });
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Checks if a PDF byte array is encrypted and identifies its security handler params.
 */
export async function isPdfEncryptedBytes(pdfBytes: Uint8Array): Promise<{
  encrypted: boolean;
  algorithm?: string;
  version?: number;
  revision?: number;
  keyLength?: number;
}> {
  try {
    const pdfDoc = await PDFDocument.load(pdfBytes, {
      ignoreEncryption: true,
      updateMetadata: false,
    });
    const context = pdfDoc.context;
    const encryptRef = (context.trailerInfo as { Encrypt?: unknown })?.Encrypt;
    if (!encryptRef) {
      return { encrypted: false };
    }

    let encryptDict: PDFDict | null = null;
    if (encryptRef instanceof PDFRef) {
      encryptDict = context.lookup(encryptRef) as PDFDict;
    } else if (encryptRef instanceof PDFDict) {
      encryptDict = encryptRef;
    }

    if (!encryptDict) return { encrypted: false };

    const V = encryptDict.get(PDFName.of('V'));
    const R = encryptDict.get(PDFName.of('R'));
    const version = V ? (typeof (V as any).asNumber === 'function' ? (V as any).asNumber() : Number(String(V))) : 0;
    const revision = R ? (typeof (R as any).asNumber === 'function' ? (R as any).asNumber() : Number(String(R))) : 0;

    let algorithm = 'RC4';
    if (version === 5 && revision === 6) algorithm = 'AES-256';
    else if (version === 4 && revision === 4) algorithm = 'AES-128';

    return {
      encrypted: true,
      algorithm,
      version,
      revision,
    };
  } catch {
    return { encrypted: false };
  }
}

/**
 * Decrypts a password-protected PDF (Uint8Array) using the provided password.
 * Robustly supports AES-128 (V=4, R=4), AES-256 (V=5, R=6), and RC4.
 */
export async function decryptPdfBytes(pdfBytes: Uint8Array, password: string): Promise<Uint8Array> {
  const cleanPassword = password ? password.trim() : '';

  // 1. Load document context with ignoreEncryption
  const pdfDoc = await PDFDocument.load(pdfBytes, {
    ignoreEncryption: true,
    updateMetadata: false,
  });

  const context = pdfDoc.context;
  const encryptRef = (context.trailerInfo as { Encrypt?: unknown })?.Encrypt;

  if (!encryptRef) {
    return pdfBytes;
  }

  let encryptDict: PDFDict | null = null;
  if (encryptRef instanceof PDFRef) {
    encryptDict = context.lookup(encryptRef) as PDFDict;
  } else if (encryptRef instanceof PDFDict) {
    encryptDict = encryptRef;
  }

  if (!encryptDict) {
    return pdfBytes;
  }

  const V = encryptDict.get(PDFName.of('V'));
  const R = encryptDict.get(PDFName.of('R'));
  const Length = encryptDict.get(PDFName.of('Length'));
  const P = encryptDict.get(PDFName.of('P'));
  const O = encryptDict.get(PDFName.of('O'));
  const U = encryptDict.get(PDFName.of('U'));

  const version = V ? (typeof (V as any).asNumber === 'function' ? (V as any).asNumber() : Number(String(V))) : 0;
  const revision = R ? (typeof (R as any).asNumber === 'function' ? (R as any).asNumber() : Number(String(R))) : 0;
  const permissions = P ? (typeof (P as any).asNumber === 'function' ? (P as any).asNumber() : Number(String(P))) : 0;

  const ownerKey = extractBytes(O);
  const userKey = extractBytes(U);

  if (!ownerKey || !userKey) {
    throw new Error('Corrupted PDF: Missing encryption keys (/O or /U)');
  }

  let fileId: any = new Uint8Array(0);
  const idArray = (context.trailerInfo as { ID?: unknown })?.ID;
  if (idArray) {
    if (Array.isArray(idArray) && idArray.length > 0) {
      fileId = extractBytes(idArray[0]) || new Uint8Array(0);
    } else if (idArray instanceof PDFArray) {
      const firstId = idArray.lookup(0);
      fileId = extractBytes(firstId) || new Uint8Array(0);
    }
  }

  // ── Route by Encryption Standard ──

  if (version === 4 && revision === 4) {
    // V=4, R=4 (AES-128) - standard bank statement format
    let keyLengthBits = Length
      ? typeof (Length as any).asNumber === 'function'
        ? (Length as any).asNumber()
        : Number(String(Length))
      : 128;
    if (!keyLengthBits) keyLengthBits = 128;

    const EncryptMetadata = encryptDict.get(PDFName.of('EncryptMetadata'));
    const encryptMetadata = EncryptMetadata ? String(EncryptMetadata) !== 'false' : true;

    // Check crypt filter in /CF
    let algorithm: 'AES-128' | 'RC4' = 'AES-128';
    const cf = encryptDict.get(PDFName.of('CF'));
    const stmf = encryptDict.get(PDFName.of('StmF'));
    if (cf && cf instanceof PDFDict) {
      const filterName = stmf ? String(stmf).replace('/', '') : 'StdCF';
      const stdCf = cf.get(PDFName.of(filterName));
      if (stdCf && stdCf instanceof PDFDict) {
        const cfm = stdCf.get(PDFName.of('CFM'));
        if (cfm && String(cfm) === '/V2') {
          algorithm = 'RC4';
        }
      }
    }

    const paramsV4: EncryptParamsV4 = {
      version,
      revision,
      ownerKey,
      userKey,
      permissions,
      fileId,
      keyLength: keyLengthBits / 8,
      encryptMetadata,
      algorithm,
      encryptRef: encryptRef as PDFRef | PDFDict,
    };

    return await decryptDocumentV4R4(pdfDoc, paramsV4, cleanPassword);
  }

  // For AES-256 (V=5, R=6) and legacy RC4 (V<=3), use @pdfsmaller/pdf-decrypt engine
  try {
    return await decryptWithPdfSmaller(pdfBytes, cleanPassword);
  } catch (error: unknown) {
    const err = error as { message?: string };
    const msg = err?.message || '';
    if (msg.includes('Incorrect password') || msg.includes('does not match')) {
      throw new Error('INCORRECT_PASSWORD');
    }
    throw error;
  }
}
