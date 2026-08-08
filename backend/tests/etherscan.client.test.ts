import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getEthBalanceWei,
  getEthPriceUsd,
  weiToEth,
} from '../src/integrations/etherscan/etherscan.client.js';

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

describe('getEthBalanceWei', () => {
  it('returns the wei balance and calls the V2 endpoint with chainid=1', async () => {
    mockFetchOnce({ status: '1', message: 'OK', result: '6634021455680168742' });

    const wei = await getEthBalanceWei('0xSomeAddress', 'my-api-key');

    expect(wei).toBe(6634021455680168742n);
    const calledUrl = vi.mocked(fetch).mock.calls[0]?.[0] as URL;
    expect(calledUrl.toString()).toContain('/v2/api');
    expect(calledUrl.searchParams.get('chainid')).toBe('1');
    expect(calledUrl.searchParams.get('address')).toBe('0xSomeAddress');
  });

  it('throws on an Etherscan-level error (status !== "1")', async () => {
    mockFetchOnce({ status: '0', message: 'NOTOK', result: 'Invalid API key' });
    await expect(getEthBalanceWei('0xbad', 'bad-key')).rejects.toThrow('NOTOK');
  });

  it('throws when the HTTP request itself fails', async () => {
    mockFetchOnce({}, false, 500);
    await expect(getEthBalanceWei('0xaddr', 'key')).rejects.toThrow('500');
  });
});

describe('weiToEth', () => {
  it('converts wei to ETH', () => {
    expect(weiToEth(1_000_000_000_000_000_000n)).toBe(1);
    expect(weiToEth(500_000_000_000_000_000n)).toBe(0.5);
  });
});

describe('getEthPriceUsd', () => {
  it('returns the USD price from CoinGecko', async () => {
    mockFetchOnce({ ethereum: { usd: 3200.5 } });
    expect(await getEthPriceUsd()).toBe(3200.5);
  });

  it('throws when CoinGecko has no price for ethereum', async () => {
    mockFetchOnce({});
    await expect(getEthPriceUsd()).rejects.toThrow('no price');
  });
});
