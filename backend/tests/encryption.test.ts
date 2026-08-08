import { describe, expect, it } from 'vitest';
import { decrypt, encrypt } from '../src/shared/utils/encryption.js';

describe('encrypt/decrypt', () => {
  it('round-trips a plaintext string', () => {
    const plaintext = 'super-secret-revolut-refresh-token';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const plaintext = 'same-input';
    expect(encrypt(plaintext)).not.toBe(encrypt(plaintext));
  });

  it('rejects a tampered payload', () => {
    const ciphertext = encrypt('some-token');
    const tampered = ciphertext.slice(0, -2) + '00';
    expect(() => decrypt(tampered)).toThrow();
  });
});
