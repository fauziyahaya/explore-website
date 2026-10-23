import { describe, expect, it } from 'vitest';
import { convertMinor, formatMoney, parseAmount, pct, toMinor } from '../src';

describe('money', () => {
  it('converts to integer sen without float drift', () => {
    expect(toMinor(1.005)).toBe(101);
    expect(toMinor(0.1 + 0.2)).toBe(30);
    expect(toMinor(-12.345)).toBe(-1235);
    expect(toMinor(1000, 'JPY')).toBe(1000);
  });
  it('parses printed amounts', () => {
    expect(parseAmount('RM1,234.50')).toBe(1234.5);
    expect(parseAmount('(12.00)')).toBe(-12);
    expect(parseAmount('1.234,50')).toBe(1234.5);
    expect(parseAmount('12.00-')).toBe(-12);
    expect(parseAmount('abc')).toBeNull();
  });
  it('formats MYR', () => {
    expect(formatMoney(123456)).toBe('RM1,234.56');
    expect(formatMoney(-500)).toBe('-RM5.00');
    expect(formatMoney(1250000, 'MYR', { compact: true })).toBe('RM12.5k');
  });
  it('converts currencies only with explicit rates', () => {
    expect(convertMinor(10000, 'USD', 'MYR', { USD: 4.4 })).toBe(44000);
    expect(() => convertMinor(100, 'EUR', 'MYR', {})).toThrow(/Missing exchange rate/);
  });
  it('returns null percentages for zero denominators', () => {
    expect(pct(5, 0)).toBeNull();
    expect(pct(1, 3)).toBe(33.33);
  });
});
