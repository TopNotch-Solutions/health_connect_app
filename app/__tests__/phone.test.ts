import { normalizeNamibianPhone } from '../../lib/phone';

describe('normalizeNamibianPhone', () => {
  it('removes + and preserves 264 prefix', () => {
    expect(normalizeNamibianPhone('+264811234567')).toBe('264811234567');
  });

  it('adds 264 when starting with 0', () => {
    expect(normalizeNamibianPhone('0811234567')).toBe('264811234567');
  });

  it('passes through when already starting with 264', () => {
    expect(normalizeNamibianPhone('264811234567')).toBe('264811234567');
  });

  it('strips non-digits like spaces and dashes', () => {
    expect(normalizeNamibianPhone('081 123-4567')).toBe('264811234567');
  });

  it('handles short inputs by prefixing 264', () => {
    expect(normalizeNamibianPhone('081123')).toBe('26481123');
  });
});
