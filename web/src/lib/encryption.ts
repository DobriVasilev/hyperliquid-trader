/**
 * E2E Encryption Library
 * Implements Signal Protocol-like encryption for DMs
 * - X3DH for key exchange
 * - Double Ratchet for forward secrecy
 * Uses Web Crypto API for cryptographic operations
 */

// Utility functions for key management
const encoder = new TextEncoder();
const decoder = new TextDecoder();

// Convert ArrayBuffer to base64
export function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Convert base64 to ArrayBuffer
export function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

// Generate ECDH key pair for key exchange
export async function generateKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDH",
      namedCurve: "P-256",
    },
    true,
    ["deriveKey", "deriveBits"]
  );

  const publicKeyBuffer = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  return {
    publicKey: bufferToBase64(publicKeyBuffer),
    privateKey: bufferToBase64(privateKeyBuffer),
  };
}

// Generate signing key pair for identity keys
export async function generateSigningKeyPair(): Promise<{
  publicKey: string;
  privateKey: string;
}> {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: "ECDSA",
      namedCurve: "P-256",
    },
    true,
    ["sign", "verify"]
  );

  const publicKeyBuffer = await crypto.subtle.exportKey("raw", keyPair.publicKey);
  const privateKeyBuffer = await crypto.subtle.exportKey("pkcs8", keyPair.privateKey);

  return {
    publicKey: bufferToBase64(publicKeyBuffer),
    privateKey: bufferToBase64(privateKeyBuffer),
  };
}

// Sign data with private key
export async function sign(
  privateKeyBase64: string,
  data: string
): Promise<string> {
  const privateKeyBuffer = base64ToBuffer(privateKeyBase64);
  const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    privateKeyBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    encoder.encode(data)
  );

  return bufferToBase64(signature);
}

// Verify signature
export async function verify(
  publicKeyBase64: string,
  signatureBase64: string,
  data: string
): Promise<boolean> {
  try {
    const publicKeyBuffer = base64ToBuffer(publicKeyBase64);
    const publicKey = await crypto.subtle.importKey(
      "raw",
      publicKeyBuffer,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"]
    );

    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      base64ToBuffer(signatureBase64),
      encoder.encode(data)
    );
  } catch {
    return false;
  }
}

// Import ECDH public key from base64
async function importECDHPublicKey(base64: string): Promise<CryptoKey> {
  const buffer = base64ToBuffer(base64);
  return crypto.subtle.importKey(
    "raw",
    buffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
}

// Import ECDH private key from base64
async function importECDHPrivateKey(base64: string): Promise<CryptoKey> {
  const buffer = base64ToBuffer(base64);
  return crypto.subtle.importKey(
    "pkcs8",
    buffer,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey", "deriveBits"]
  );
}

// Derive shared secret using ECDH
async function deriveSharedSecret(
  privateKeyBase64: string,
  publicKeyBase64: string
): Promise<ArrayBuffer> {
  const privateKey = await importECDHPrivateKey(privateKeyBase64);
  const publicKey = await importECDHPublicKey(publicKeyBase64);

  return crypto.subtle.deriveBits(
    { name: "ECDH", public: publicKey },
    privateKey,
    256
  );
}

// Key Derivation Function using HKDF
async function hkdf(
  inputKeyMaterial: ArrayBuffer,
  salt: ArrayBuffer,
  info: string,
  length: number
): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey(
    "raw",
    inputKeyMaterial,
    "HKDF",
    false,
    ["deriveBits"]
  );

  return crypto.subtle.deriveBits(
    {
      name: "HKDF",
      salt,
      info: encoder.encode(info),
      hash: "SHA-256",
    },
    key,
    length * 8
  );
}

// X3DH Key Agreement
export interface X3DHKeyBundle {
  identityPublicKey: string;
  signedPrekeyId: number;
  signedPrekeyPublic: string;
  signedPrekeySignature: string;
  oneTimePrekeyId?: number;
  oneTimePrekeyPublic?: string;
}

export interface X3DHInitiatorResult {
  sharedKey: string;
  ephemeralPublic: string;
  usedOneTimePrekeyId?: number;
}

// X3DH initiator (Alice) - creates initial shared key
export async function x3dhInitiate(
  myIdentityPrivate: string,
  theirKeyBundle: X3DHKeyBundle
): Promise<X3DHInitiatorResult> {
  // Verify signed prekey signature
  const isValid = await verify(
    theirKeyBundle.identityPublicKey,
    theirKeyBundle.signedPrekeySignature,
    theirKeyBundle.signedPrekeyPublic
  );

  if (!isValid) {
    throw new Error("Invalid signed prekey signature");
  }

  // Generate ephemeral key pair
  const ephemeralKeyPair = await generateKeyPair();

  // Perform X3DH
  // DH1 = DH(IKa, SPKb)
  const dh1 = await deriveSharedSecret(
    myIdentityPrivate,
    theirKeyBundle.signedPrekeyPublic
  );

  // DH2 = DH(EKa, IKb)
  const dh2 = await deriveSharedSecret(
    ephemeralKeyPair.privateKey,
    theirKeyBundle.identityPublicKey
  );

  // DH3 = DH(EKa, SPKb)
  const dh3 = await deriveSharedSecret(
    ephemeralKeyPair.privateKey,
    theirKeyBundle.signedPrekeyPublic
  );

  // Optional: DH4 with one-time prekey
  let dh4: ArrayBuffer | null = null;
  if (theirKeyBundle.oneTimePrekeyPublic) {
    dh4 = await deriveSharedSecret(
      ephemeralKeyPair.privateKey,
      theirKeyBundle.oneTimePrekeyPublic
    );
  }

  // Concatenate DH outputs
  const totalLength = dh1.byteLength + dh2.byteLength + dh3.byteLength + (dh4?.byteLength || 0);
  const combined = new Uint8Array(totalLength);
  combined.set(new Uint8Array(dh1), 0);
  combined.set(new Uint8Array(dh2), dh1.byteLength);
  combined.set(new Uint8Array(dh3), dh1.byteLength + dh2.byteLength);
  if (dh4) {
    combined.set(new Uint8Array(dh4), dh1.byteLength + dh2.byteLength + dh3.byteLength);
  }

  // Derive shared key using HKDF
  const salt = new Uint8Array(32); // All zeros as per Signal spec
  const sharedKeyBuffer = await hkdf(combined.buffer, salt.buffer, "X3DH", 32);

  return {
    sharedKey: bufferToBase64(sharedKeyBuffer),
    ephemeralPublic: ephemeralKeyPair.publicKey,
    usedOneTimePrekeyId: theirKeyBundle.oneTimePrekeyId,
  };
}

// X3DH responder (Bob) - derives shared key from initiator's message
export async function x3dhRespond(
  myIdentityPrivate: string,
  mySignedPrekeyPrivate: string,
  myOneTimePrekeyPrivate: string | null,
  theirIdentityPublic: string,
  theirEphemeralPublic: string
): Promise<string> {
  // DH1 = DH(SPKb, IKa)
  const dh1 = await deriveSharedSecret(mySignedPrekeyPrivate, theirIdentityPublic);

  // DH2 = DH(IKb, EKa)
  const dh2 = await deriveSharedSecret(myIdentityPrivate, theirEphemeralPublic);

  // DH3 = DH(SPKb, EKa)
  const dh3 = await deriveSharedSecret(mySignedPrekeyPrivate, theirEphemeralPublic);

  // Optional: DH4 with one-time prekey
  let dh4: ArrayBuffer | null = null;
  if (myOneTimePrekeyPrivate) {
    dh4 = await deriveSharedSecret(myOneTimePrekeyPrivate, theirEphemeralPublic);
  }

  // Concatenate DH outputs (same order as initiator)
  const totalLength = dh1.byteLength + dh2.byteLength + dh3.byteLength + (dh4?.byteLength || 0);
  const combined = new Uint8Array(totalLength);
  combined.set(new Uint8Array(dh1), 0);
  combined.set(new Uint8Array(dh2), dh1.byteLength);
  combined.set(new Uint8Array(dh3), dh1.byteLength + dh2.byteLength);
  if (dh4) {
    combined.set(new Uint8Array(dh4), dh1.byteLength + dh2.byteLength + dh3.byteLength);
  }

  // Derive shared key
  const salt = new Uint8Array(32);
  const sharedKeyBuffer = await hkdf(combined.buffer, salt.buffer, "X3DH", 32);

  return bufferToBase64(sharedKeyBuffer);
}

// Double Ratchet Session State
export interface RatchetState {
  rootKey: string;
  chainKey: string;
  sendingChainKey: string | null;
  receivingChainKey: string | null;
  sendingRatchetPrivate: string;
  sendingRatchetPublic: string;
  receivingRatchetPublic: string | null;
  messageNumber: number;
  previousChainLength: number;
}

// Initialize ratchet as initiator
export async function initRatchetAsInitiator(
  sharedKey: string,
  theirRatchetPublic: string
): Promise<RatchetState> {
  // Generate our sending ratchet key pair
  const sendingRatchet = await generateKeyPair();

  // Perform DH ratchet step
  const dhOutput = await deriveSharedSecret(sendingRatchet.privateKey, theirRatchetPublic);
  const salt = base64ToBuffer(sharedKey);

  // Derive new root key and chain key
  const derived = await hkdf(dhOutput, salt, "DoubleRatchet", 64);
  const newRootKey = new Uint8Array(derived.slice(0, 32));
  const newChainKey = new Uint8Array(derived.slice(32, 64));

  return {
    rootKey: bufferToBase64(newRootKey.buffer),
    chainKey: bufferToBase64(newChainKey.buffer),
    sendingChainKey: bufferToBase64(newChainKey.buffer),
    receivingChainKey: null,
    sendingRatchetPrivate: sendingRatchet.privateKey,
    sendingRatchetPublic: sendingRatchet.publicKey,
    receivingRatchetPublic: theirRatchetPublic,
    messageNumber: 0,
    previousChainLength: 0,
  };
}

// Initialize ratchet as responder
export async function initRatchetAsResponder(
  sharedKey: string,
  myRatchetKeyPair: { publicKey: string; privateKey: string }
): Promise<RatchetState> {
  return {
    rootKey: sharedKey,
    chainKey: sharedKey,
    sendingChainKey: null,
    receivingChainKey: null,
    sendingRatchetPrivate: myRatchetKeyPair.privateKey,
    sendingRatchetPublic: myRatchetKeyPair.publicKey,
    receivingRatchetPublic: null,
    messageNumber: 0,
    previousChainLength: 0,
  };
}

// Derive message key from chain key
async function deriveMessageKey(
  chainKey: string
): Promise<{ messageKey: string; newChainKey: string }> {
  const chainKeyBuffer = base64ToBuffer(chainKey);

  // Derive message key (HMAC with 0x01)
  const messageKeyMaterial = await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey("raw", chainKeyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    new Uint8Array([0x01])
  );

  // Derive new chain key (HMAC with 0x02)
  const newChainKeyMaterial = await crypto.subtle.sign(
    "HMAC",
    await crypto.subtle.importKey("raw", chainKeyBuffer, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    new Uint8Array([0x02])
  );

  return {
    messageKey: bufferToBase64(messageKeyMaterial),
    newChainKey: bufferToBase64(newChainKeyMaterial),
  };
}

// Encrypt message
export async function encryptMessage(
  state: RatchetState,
  plaintext: string
): Promise<{ ciphertext: string; header: EncryptedMessageHeader; newState: RatchetState }> {
  // Get message key
  const { messageKey, newChainKey } = await deriveMessageKey(state.sendingChainKey || state.chainKey);

  // Generate IV
  const iv = crypto.getRandomValues(new Uint8Array(12));

  // Import message key for AES-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    base64ToBuffer(messageKey).slice(0, 32),
    "AES-GCM",
    false,
    ["encrypt"]
  );

  // Encrypt
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    encoder.encode(plaintext)
  );

  // Create header
  const header: EncryptedMessageHeader = {
    ratchetPublic: state.sendingRatchetPublic,
    messageNumber: state.messageNumber,
    previousChainLength: state.previousChainLength,
    iv: bufferToBase64(iv.buffer),
  };

  // Update state
  const newState: RatchetState = {
    ...state,
    sendingChainKey: newChainKey,
    messageNumber: state.messageNumber + 1,
  };

  return {
    ciphertext: bufferToBase64(ciphertext),
    header,
    newState,
  };
}

export interface EncryptedMessageHeader {
  ratchetPublic: string;
  messageNumber: number;
  previousChainLength: number;
  iv: string;
}

// Decrypt message
export async function decryptMessage(
  state: RatchetState,
  ciphertext: string,
  header: EncryptedMessageHeader
): Promise<{ plaintext: string; newState: RatchetState }> {
  let currentState = { ...state };

  // Check if we need to do a DH ratchet step
  if (header.ratchetPublic !== currentState.receivingRatchetPublic) {
    // Perform DH ratchet
    const dhOutput = await deriveSharedSecret(
      currentState.sendingRatchetPrivate,
      header.ratchetPublic
    );

    const derived = await hkdf(
      dhOutput,
      base64ToBuffer(currentState.rootKey),
      "DoubleRatchet",
      64
    );

    const newRootKey = new Uint8Array(derived.slice(0, 32));
    const newChainKey = new Uint8Array(derived.slice(32, 64));

    // Generate new sending ratchet
    const newSendingRatchet = await generateKeyPair();

    // Second DH for sending chain
    const dhOutput2 = await deriveSharedSecret(
      newSendingRatchet.privateKey,
      header.ratchetPublic
    );

    const derived2 = await hkdf(
      dhOutput2,
      newRootKey.buffer,
      "DoubleRatchet",
      64
    );

    currentState = {
      rootKey: bufferToBase64(new Uint8Array(derived2.slice(0, 32)).buffer),
      chainKey: bufferToBase64(newChainKey.buffer),
      sendingChainKey: bufferToBase64(new Uint8Array(derived2.slice(32, 64)).buffer),
      receivingChainKey: bufferToBase64(newChainKey.buffer),
      sendingRatchetPrivate: newSendingRatchet.privateKey,
      sendingRatchetPublic: newSendingRatchet.publicKey,
      receivingRatchetPublic: header.ratchetPublic,
      messageNumber: 0,
      previousChainLength: state.messageNumber,
    };
  }

  // Get message key
  const { messageKey, newChainKey } = await deriveMessageKey(
    currentState.receivingChainKey || currentState.chainKey
  );

  // Import message key for AES-GCM
  const aesKey = await crypto.subtle.importKey(
    "raw",
    base64ToBuffer(messageKey).slice(0, 32),
    "AES-GCM",
    false,
    ["decrypt"]
  );

  // Decrypt
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64ToBuffer(header.iv) },
    aesKey,
    base64ToBuffer(ciphertext)
  );

  // Update state
  const newState: RatchetState = {
    ...currentState,
    receivingChainKey: newChainKey,
  };

  return {
    plaintext: decoder.decode(plaintext),
    newState,
  };
}

// Generate safety number fingerprint
export async function generateSafetyNumber(
  userId1: string,
  identityKey1: string,
  userId2: string,
  identityKey2: string
): Promise<string> {
  // Sort by user ID for consistent ordering
  const [firstId, firstKey, secondId, secondKey] =
    userId1 < userId2
      ? [userId1, identityKey1, userId2, identityKey2]
      : [userId2, identityKey2, userId1, identityKey1];

  // Hash the combined data
  const data = encoder.encode(`${firstId}${firstKey}${secondId}${secondKey}`);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hashArray = new Uint8Array(hash);

  // Format as groups of 5 digits
  const groups: string[] = [];
  for (let i = 0; i < 30; i += 5) {
    const num =
      (hashArray[i] << 24) |
      (hashArray[i + 1] << 16) |
      (hashArray[i + 2] << 8) |
      hashArray[i + 3];
    groups.push(String(Math.abs(num) % 100000).padStart(5, "0"));
  }

  return groups.join(" ");
}

// Key bundle generation for user registration
export async function generateKeyBundle(): Promise<{
  identityKeyPair: { publicKey: string; privateKey: string };
  signedPrekey: {
    id: number;
    publicKey: string;
    privateKey: string;
    signature: string;
  };
  oneTimePrekeys: Array<{
    id: number;
    publicKey: string;
    privateKey: string;
  }>;
}> {
  // Generate identity key pair (signing)
  const identityKeyPair = await generateSigningKeyPair();

  // Generate signed prekey
  const signedPrekeyId = Date.now();
  const signedPrekey = await generateKeyPair();
  const signedPrekeySignature = await sign(
    identityKeyPair.privateKey,
    signedPrekey.publicKey
  );

  // Generate one-time prekeys (10 by default)
  const oneTimePrekeys: Array<{
    id: number;
    publicKey: string;
    privateKey: string;
  }> = [];

  for (let i = 0; i < 10; i++) {
    const keyPair = await generateKeyPair();
    oneTimePrekeys.push({
      id: signedPrekeyId + i + 1,
      publicKey: keyPair.publicKey,
      privateKey: keyPair.privateKey,
    });
  }

  return {
    identityKeyPair,
    signedPrekey: {
      id: signedPrekeyId,
      publicKey: signedPrekey.publicKey,
      privateKey: signedPrekey.privateKey,
      signature: signedPrekeySignature,
    },
    oneTimePrekeys,
  };
}
