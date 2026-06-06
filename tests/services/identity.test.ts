import { describe, it, expect } from 'vitest';
import { getCanonicalIdHash, normalizeWhatsAppId } from '../../src/services/identity';

describe('Identity Canonicalization (FT-124)', () => {
  describe('normalizeWhatsAppId', () => {
    it('should remove device suffix and server domain for DM', () => {
      const dmId = '628123456789.0:12@s.whatsapp.net';
      expect(normalizeWhatsAppId(dmId)).toBe('628123456789');
    });

    it('should remove "@lid" suffix', () => {
      const lidId = '628123456789@lid';
      expect(normalizeWhatsAppId(lidId)).toBe('628123456789');
    });

    it('should retain group IDs without modification', () => {
      const groupId = '1234567890-12345678@g.us';
      expect(normalizeWhatsAppId(groupId)).toBe('1234567890-12345678@g.us');
    });

    it('should handle IDs without suffix/domain', () => {
      const cleanId = '628123456789';
      expect(normalizeWhatsAppId(cleanId)).toBe('628123456789');
    });

    it('should return empty string for null/undefined input', () => {
      expect(normalizeWhatsAppId(null as any)).toBe('');
      expect(normalizeWhatsAppId(undefined as any)).toBe('');
      expect(normalizeWhatsAppId('')).toBe('');
    });
  });

  describe('getCanonicalIdHash', () => {
    it('should return consistent hash for different formats of the same WhatsApp number (DM)', () => {
      const dmId = '628123456789.0:12@s.whatsapp.net';
      const lidId = '628123456789@lid';
      const cleanId = '628123456789';

      const hash1 = getCanonicalIdHash('NANOBOT_WHATSAPP', dmId);
      const hash2 = getCanonicalIdHash('NANOBOT_WHATSAPP', lidId);
      const hash3 = getCanonicalIdHash('NANOBOT_WHATSAPP', cleanId);

      expect(hash1).toBe(hash2);
      expect(hash2).toBe(hash3);
      expect(hash1).not.toBe('');
    });

    it('should return a different hash for a different WhatsApp number', () => {
      const id1 = '628123456789@lid';
      const id2 = '628987654321@s.whatsapp.net';

      const hash1 = getCanonicalIdHash('NANOBOT_WHATSAPP', id1);
      const hash2 = getCanonicalIdHash('NANOBOT_WHATSAPP', id2);

      expect(hash1).not.toBe(hash2);
    });

    it('should return a different hash for group IDs compared to phone numbers', () => {
      const dmId = '628123456789@lid';
      const groupId = '1234567890-12345678@g.us';

      const hash1 = getCanonicalIdHash('NANOBOT_WHATSAPP', dmId);
      const hash2 = getCanonicalIdHash('NANOBOT_WHATSAPP', groupId);

      expect(hash1).not.toBe(hash2);
    });

    it('should handle different providers with different hashes', () => {
      const id = 'some_id';
      const hashWhatsapp = getCanonicalIdHash('NANOBOT_WHATSAPP', id);
      const hashTelegram = getCanonicalIdHash('TELEGRAM', id);

      expect(hashWhatsapp).not.toBe(hashTelegram);
    });
  });
});
