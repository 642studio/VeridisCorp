import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { encryptSecret, decryptSecret, loadEncryptionKey, signFileAccess, verifyFileAccessSignature } from '../src/runtime/secrets.js';

test('encryptSecret/decryptSecret hacen un roundtrip real y detectan clave o blob alterados', () => {
  const key = randomBytes(32);
  const blob = encryptSecret('refresh-token-de-prueba', key);
  assert.equal(decryptSecret(blob, key), 'refresh-token-de-prueba');
  assert.throws(() => decryptSecret(blob, randomBytes(32)), 'clave equivocada debe rechazarse (GCM)');
  const tampered = Buffer.from(blob); tampered.writeUInt8(tampered.readUInt8(tampered.length - 1) ^ 0xff, tampered.length - 1);
  assert.throws(() => decryptSecret(tampered, key), 'un blob alterado debe rechazarse (GCM)');
});

test('loadEncryptionKey exige una clave de 32 bytes en base64', () => {
  const key = randomBytes(32);
  assert.ok(loadEncryptionKey({ VERIDIS_TOKEN_ENCRYPTION_KEY: key.toString('base64') }).equals(key));
  assert.throws(() => loadEncryptionKey({}), /Falta VERIDIS_TOKEN_ENCRYPTION_KEY/);
  assert.throws(() => loadEncryptionKey({ VERIDIS_TOKEN_ENCRYPTION_KEY: randomBytes(16).toString('base64') }), /32 bytes/);
});

test('signFileAccess/verifyFileAccessSignature: la firma es real, no decorativa', () => {
  const key = randomBytes(32);
  const exp = Date.now() + 60000;
  const sig = signFileAccess('file-1', exp, key);
  assert.equal(verifyFileAccessSignature('file-1', exp, sig, key), true);
  // Firma de otro fileId, otro exp o con otra clave: ninguna debe validar con los datos originales.
  assert.equal(verifyFileAccessSignature('file-2', exp, sig, key), false);
  assert.equal(verifyFileAccessSignature('file-1', exp + 1, sig, key), false);
  assert.equal(verifyFileAccessSignature('file-1', exp, sig, randomBytes(32)), false);
  // Entrada no-hex o de otra longitud no debe lanzar, solo no validar.
  assert.equal(verifyFileAccessSignature('file-1', exp, 'no-es-hex', key), false);
  assert.equal(verifyFileAccessSignature('file-1', exp, '', key), false);
});
