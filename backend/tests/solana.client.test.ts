import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSolBalanceLamports,
  getSolPriceUsd,
  lamportsToSol,
} from '../src/integrations/solana/solana.client.js';

function mockFetchOnce(body: unknown, ok = true, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok,
      status,
      json: () => Promise.resolve(body),
    }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getSolBalanceLamports', () => {
  it('returns the lamports balance from a successful RPC response', async () => {
    mockFetchOnce({ result: { value: 123_456_789 } });

    const lamports = await getSolBalanceLamports('https://rpc.example', 'SomeAddress');

    expect(lamports).toBe(123_456_789);
    expect(fetch).toHaveBeenCalledWith(
      'https://rpc.example',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBalance',
          params: ['SomeAddress'],
        }),
      }),
    );
  });

  it('throws when the RPC returns an error', async () => {
    mockFetchOnce({ error: { message: 'Invalid param: WrongSize' } });
    await expect(getSolBalanceLamports('https://rpc.example', 'bad')).rejects.toThrow(
      'Invalid param',
    );
  });

  it('throws when the HTTP request itself fails', async () => {
    mockFetchOnce({}, false, 503);
    await expect(getSolBalanceLamports('https://rpc.example', 'addr')).rejects.toThrow('503');
  });
});

describe('lamportsToSol', () => {
  it('converts lamports to SOL', () => {
    expect(lamportsToSol(1_000_000_000)).toBe(1);
    expect(lamportsToSol(2_500_000_000)).toBe(2.5);
  });
});

describe('getSolPriceUsd', () => {
  it('returns the USD price from CoinGecko', async () => {
    mockFetchOnce({ solana: { usd: 150.5 } });
    const price = await getSolPriceUsd();
    expect(price).toBe(150.5);
  });

  it('throws when CoinGecko has no price for solana', async () => {
    mockFetchOnce({});
    await expect(getSolPriceUsd()).rejects.toThrow('no price');
  });
});
