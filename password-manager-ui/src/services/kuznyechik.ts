const BLOCK_SIZE = 16;
const PI = new Uint8Array([
  252, 238, 221, 17, 207, 110, 49, 22, 251, 196, 250, 218, 35, 197, 4, 77, 233, 119, 240, 219, 147,
  46, 153, 186, 23, 54, 241, 187, 20, 205, 95, 193, 249, 24, 101, 90, 226, 92, 239, 33, 129, 28, 60, 66,
  139, 1, 142, 79, 5, 132, 2, 174, 227, 106, 143, 160, 6, 11, 237, 152, 127, 212, 211, 31, 235, 52, 44, 81,
  234, 200, 72, 171, 242, 42, 104, 162, 253, 58, 206, 204, 181, 112, 14, 86, 8, 12, 118, 18, 191, 114, 19,
  71, 156, 183, 93, 135, 21, 161, 150, 41, 16, 123, 154, 199, 243, 145, 120, 111, 157, 158, 178, 177, 50,
  117, 25, 61, 255, 53, 138, 126, 109, 84, 198, 128, 195, 189, 13, 87, 223, 245, 36, 169, 62, 168, 67,
  201, 215, 121, 214, 246, 124, 34, 185, 3, 224, 15, 236, 222, 122, 148, 176, 188, 220, 232, 40, 80, 78,
  51, 10, 74, 167, 151, 96, 115, 30, 0, 98, 68, 26, 184, 56, 130, 100, 159, 38, 65, 173, 69, 70, 146, 39,
  94, 85, 47, 140, 163, 165, 125, 105, 213, 149, 59, 7, 88, 179, 64, 134, 172, 29, 247, 48, 55, 107, 228,
  136, 217, 231, 137, 225, 27, 131, 73, 76, 63, 248, 254, 141, 83, 170, 144, 202, 216, 133, 97, 32, 113,
  103, 164, 45, 43, 9, 91, 203, 155, 37, 208, 190, 229, 108, 82, 89, 166, 116, 210, 230, 244, 180, 192,
  209, 102, 175, 194, 57, 75, 99, 182,
]);
const L_VECTOR = new Uint8Array([148, 32, 133, 16, 194, 192, 1, 251, 1, 192, 194, 16, 133, 32, 148, 1]);

function xorBlocks(a: Uint8Array, b: Uint8Array): Uint8Array {
  const result = new Uint8Array(BLOCK_SIZE);
  for (let index = 0; index < BLOCK_SIZE; index += 1) {
    result[index] = a[index] ^ b[index];
  }
  return result;
}

function gfMul(a: number, b: number): number {
  let left = a;
  let right = b;
  let result = 0;

  while (right > 0) {
    if (right & 1) result ^= left;

    const carry = left & 0x80;
    left = (left << 1) & 0xff;
    if (carry) left ^= 0xc3;

    right >>= 1;
  }

  return result;
}

function applyS(block: Uint8Array): Uint8Array {
  const result = new Uint8Array(BLOCK_SIZE);
  for (let index = 0; index < BLOCK_SIZE; index += 1) {
    result[index] = PI[block[index]];
  }
  return result;
}

function applyR(block: Uint8Array): Uint8Array {
  const result = new Uint8Array(BLOCK_SIZE);
  let first = 0;

  for (let index = 0; index < BLOCK_SIZE; index += 1) {
    if (index > 0) {
      result[index] = block[index - 1];
    }
    first ^= gfMul(block[index], L_VECTOR[index]);
  }

  result[0] = first;
  return result;
}

function applyL(block: Uint8Array): Uint8Array {
  let result = block.slice();
  for (let round = 0; round < BLOCK_SIZE; round += 1) {
    result = applyR(result);
  }
  return result;
}

function splitMasterKey(key: Uint8Array): [Uint8Array, Uint8Array] {
  const half = key.length / 2;
  const left = new Uint8Array(half);
  const right = new Uint8Array(half);

  for (let index = 0; index < half; index += 1) {
    left[index] = key[index];
    right[half - 1 - index] = key[key.length - 1 - index];
  }

  return [left, right];
}

function feistelChain(key1: Uint8Array, key2: Uint8Array, constant: Uint8Array): [Uint8Array, Uint8Array] {
  const transformed = applyL(applyS(xorBlocks(key1, constant)));
  return [xorBlocks(transformed, key2), key1.slice()];
}

function getIterationConstants(): Uint8Array[] {
  const result: Uint8Array[] = [];
  for (let index = 0; index < 32; index += 1) {
    const vector = new Uint8Array(BLOCK_SIZE);
    vector[15] = index + 1;
    result.push(applyL(vector));
  }
  return result;
}

function expandKey(masterKey: Uint8Array): Uint8Array[] {
  const [first, second] = splitMasterKey(masterKey);
  const iterationKeys: Uint8Array[] = new Array(10);
  iterationKeys[0] = first.slice();
  iterationKeys[1] = second.slice();

  const constants = getIterationConstants();
  let keyPair: [Uint8Array, Uint8Array] = [first.slice(), second.slice()];

  for (let block = 0; block < 4; block += 1) {
    for (let offset = 0; offset < 8; offset += 1) {
      keyPair = feistelChain(keyPair[0], keyPair[1], constants[block * 8 + offset]);
    }
    iterationKeys[block * 2 + 2] = keyPair[0].slice();
    iterationKeys[block * 2 + 3] = keyPair[1].slice();
  }

  return iterationKeys;
}

function encryptBlock(masterKey: Uint8Array, input: Uint8Array): Uint8Array {
  const iterationKeys = expandKey(masterKey);
  let state = input.slice();

  for (let round = 0; round < 9; round += 1) {
    state = xorBlocks(iterationKeys[round], state);
    state = applyS(state);
    state = applyL(state);
  }

  return xorBlocks(state, iterationKeys[9]);
}

function incrementCounter(counter: Uint8Array): void {
  for (let index = BLOCK_SIZE - 1; index >= 0; index -= 1) {
    counter[index] = (counter[index] + 1) & 0xff;
    if (counter[index] !== 0) {
      break;
    }
  }
}

function transformCtr(payload: Uint8Array, masterKey: Uint8Array, nonce: Uint8Array): Uint8Array {
  const result = new Uint8Array(payload.length);
  const counter = nonce.slice();

  for (let offset = 0; offset < payload.length; offset += BLOCK_SIZE) {
    const gamma = encryptBlock(masterKey, counter);
    const chunkLength = Math.min(BLOCK_SIZE, payload.length - offset);

    for (let index = 0; index < chunkLength; index += 1) {
      result[offset + index] = payload[offset + index] ^ gamma[index];
    }

    incrementCounter(counter);
  }

  return result;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const result = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    result[index] = binary.charCodeAt(index);
  }
  return result;
}

async function sha256(input: Uint8Array): Promise<Uint8Array> {
  const hash = await crypto.subtle.digest('SHA-256', input);
  return new Uint8Array(hash);
}

export async function deriveKuznyechikKey(masterPassword: string, salt: string): Promise<Uint8Array> {
  const encoder = new TextEncoder();
  let material = encoder.encode(`${masterPassword}:${salt}:kuznyechik-zk`);

  for (let round = 0; round < 5000; round += 1) {
    material = await sha256(material);
  }

  return material;
}

export async function encryptStringWithKuznyechik(plainText: string, masterPassword: string, salt: string): Promise<{ ciphertext: string; nonce: string }> {
  const key = await deriveKuznyechikKey(masterPassword, salt);
  const nonce = crypto.getRandomValues(new Uint8Array(BLOCK_SIZE));
  const data = new TextEncoder().encode(plainText);
  const encrypted = transformCtr(data, key, nonce);

  return {
    ciphertext: bytesToBase64(encrypted),
    nonce: bytesToBase64(nonce),
  };
}

export async function decryptStringWithKuznyechik(ciphertext: string, nonce: string, masterPassword: string, salt: string): Promise<string> {
  const key = await deriveKuznyechikKey(masterPassword, salt);
  const encryptedBytes = base64ToBytes(ciphertext);
  const nonceBytes = base64ToBytes(nonce);
  const decrypted = transformCtr(encryptedBytes, key, nonceBytes);

  return new TextDecoder().decode(decrypted);
}
