import { afterEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { eq } from 'drizzle-orm';
import TCGdex from '@tcgdex/sdk';
import { createApp } from '../src/app.js';
import { db } from '../src/config/database.js';
import * as schema from '../src/db/schema/index.js';

const app = createApp();
const originalTcgdexFetch = TCGdex.fetch;

afterEach(() => {
  TCGdex.fetch = originalTcgdexFetch;
  vi.unstubAllGlobals();
});

async function registerAndGetToken() {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/v1/auth/register')
    .send({ email: 'test@example.com', password: 'correcthorsebattery', name: 'Test User' });
  const accessToken = res.body.data.accessToken as string;
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.email, 'test@example.com'));
  return { agent, accessToken, userId: user!.id };
}

function jsonResponse(body: unknown, status = 200) {
  return { status, json: () => Promise.resolve(body) };
}

describe('collectibles module', () => {
  describe('GET /config', () => {
    it('reports pokemonpricetracker/poketrace as unconfigured when no key is set', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .get('/api/v1/collectibles/config')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        pokemonPriceTrackerConfigured: false,
        poketraceConfigured: false,
      });
    });
  });

  describe('CRUD', () => {
    it('creates a card with a default tcgdex price source', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .post('/api/v1/collectibles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          itemType: 'card',
          name: 'Dracaufeu',
          purchasePrice: 5000,
          purchaseDate: '2026-01-01',
          tcgdexId: 'swsh3-136',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.priceSource).toBe('tcgdex');
      expect(res.body.data.tcgType).toBe('pokemon');
    });

    it('creates a manually-entered card for a non-Pokémon game', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .post('/api/v1/collectibles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          itemType: 'card',
          name: 'Monkey D. Luffy',
          purchasePrice: 3000,
          purchaseDate: '2026-01-01',
          tcgType: 'onepiece',
          priceSource: 'manual',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.tcgType).toBe('onepiece');
      expect(res.body.data.priceSource).toBe('manual');
    });

    it('creates a sealed item with a default manual price source', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .post('/api/v1/collectibles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          itemType: 'sealed',
          name: 'Display Écarlate et Violet',
          purchasePrice: 12000,
          purchaseDate: '2026-01-01',
          sealedType: 'display',
          sealedLanguage: 'FR',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.priceSource).toBe('manual');
    });

    it('creates a watch, always with a manual price source', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const res = await agent
        .post('/api/v1/collectibles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          itemType: 'watch',
          name: 'Submariner Date',
          purchasePrice: 950000,
          purchaseDate: '2024-05-01',
          brand: 'Rolex',
          model: 'Submariner',
          reference: '126610LN',
          year: 2023,
          watchCondition: 'Occasion — excellent état',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.priceSource).toBe('manual');
      expect(res.body.data.brand).toBe('Rolex');
      expect(res.body.data.reference).toBe('126610LN');
    });

    it('lists items filtered by type', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      await agent
        .post('/api/v1/collectibles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ itemType: 'card', name: 'Carte', purchasePrice: 100, purchaseDate: '2026-01-01' });
      await agent.post('/api/v1/collectibles').set('Authorization', `Bearer ${accessToken}`).send({
        itemType: 'sealed',
        name: 'Scellé',
        purchasePrice: 200,
        purchaseDate: '2026-01-01',
      });

      const res = await agent
        .get('/api/v1/collectibles')
        .query({ type: 'sealed' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].itemType).toBe('sealed');
    });

    it('gets an item with its price history, updates and deletes it', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/collectibles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ itemType: 'card', name: 'Carte', purchasePrice: 100, purchaseDate: '2026-01-01' });
      const id = createRes.body.data.id as string;

      const getRes = await agent
        .get(`/api/v1/collectibles/${id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.status).toBe(200);
      expect(getRes.body.data.item.id).toBe(id);
      expect(getRes.body.data.history).toEqual([]);

      const putRes = await agent
        .put(`/api/v1/collectibles/${id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ name: 'Carte renommée' });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.name).toBe('Carte renommée');

      const deleteRes = await agent
        .delete(`/api/v1/collectibles/${id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(204);

      const afterDelete = await agent
        .get(`/api/v1/collectibles/${id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(afterDelete.status).toBe(404);
    });

    it("rejects access to another user's item", async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignItem] = await db
        .insert(schema.collectibleItems)
        .values({
          userId: otherUser!.id,
          itemType: 'card',
          name: 'Not yours',
          purchasePrice: 100,
          purchaseDate: '2026-01-01',
        })
        .returning();

      const res = await agent
        .get(`/api/v1/collectibles/${foreignItem!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });
  });

  describe('PUT /:id/price', () => {
    it('creates a manual price snapshot', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/collectibles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          itemType: 'sealed',
          name: 'Scellé',
          purchasePrice: 10000,
          purchaseDate: '2026-01-01',
        });
      const id = createRes.body.data.id as string;

      const res = await agent
        .put(`/api/v1/collectibles/${id}/price`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ priceEur: 12000, note: 'vu sur Cardmarket' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ marketPriceEur: 12000, source: 'manual' });

      const getRes = await agent
        .get(`/api/v1/collectibles/${id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.body.data.history).toHaveLength(1);
    });
  });

  describe('PATCH & DELETE /:id/price/:snapshotId', () => {
    async function createItemWithSnapshot(agent: ReturnType<typeof request.agent>, accessToken: string) {
      const createRes = await agent
        .post('/api/v1/collectibles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ itemType: 'sealed', name: 'Scellé', purchasePrice: 10000, purchaseDate: '2026-01-01' });
      const itemId = createRes.body.data.id as string;
      const priceRes = await agent
        .put(`/api/v1/collectibles/${itemId}/price`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ priceEur: 12000, note: 'vu sur Cardmarket' });
      return { itemId, snapshotId: priceRes.body.data.id as string };
    }

    it('edits a price snapshot (fixes a typo)', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const { itemId, snapshotId } = await createItemWithSnapshot(agent, accessToken);

      const res = await agent
        .patch(`/api/v1/collectibles/${itemId}/price/${snapshotId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ priceEur: 9000, note: 'corrigé' });

      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ id: snapshotId, marketPriceEur: 9000 });

      const getRes = await agent
        .get(`/api/v1/collectibles/${itemId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.body.data.history[0].marketPriceEur).toBe(9000);
    });

    it('deletes a price snapshot', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const { itemId, snapshotId } = await createItemWithSnapshot(agent, accessToken);

      const res = await agent
        .delete(`/api/v1/collectibles/${itemId}/price/${snapshotId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(204);

      const getRes = await agent
        .get(`/api/v1/collectibles/${itemId}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(getRes.body.data.history).toEqual([]);
    });

    it('rejects editing/deleting a snapshot belonging to another user\'s item', async () => {
      // Single-user registration is enforced (REGISTRATION_CLOSED past the first account) —
      // same workaround as "rejects access to another user's item" above: insert the foreign
      // user/item/snapshot directly rather than registering a second account.
      const { agent, accessToken } = await registerAndGetToken();
      const [otherUser] = await db
        .insert(schema.users)
        .values({ email: 'other-snap@example.com', passwordHash: 'x', name: 'Other' })
        .returning();
      const [foreignItem] = await db
        .insert(schema.collectibleItems)
        .values({
          userId: otherUser!.id,
          itemType: 'sealed',
          name: 'Not yours',
          purchasePrice: 100,
          purchaseDate: '2026-01-01',
        })
        .returning();
      const [foreignSnapshot] = await db
        .insert(schema.collectiblePriceSnapshots)
        .values({ itemId: foreignItem!.id, marketPriceEur: 500, source: 'manual' })
        .returning();

      const patchRes = await agent
        .patch(`/api/v1/collectibles/${foreignItem!.id}/price/${foreignSnapshot!.id}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ priceEur: 1 });
      expect(patchRes.status).toBe(404);

      const deleteRes = await agent
        .delete(`/api/v1/collectibles/${foreignItem!.id}/price/${foreignSnapshot!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(deleteRes.status).toBe(404);
    });
  });

  describe('GET /:id/image', () => {
    it('proxies the stored image with a guessed Referer', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/collectibles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          itemType: 'sealed',
          name: 'Scellé',
          purchasePrice: 10000,
          purchaseDate: '2026-01-01',
          imageUrl: 'https://product-images.s3.cardmarket.com/53/846734/846734.jpg',
        });
      const id = createRes.body.data.id as string;

      const fetchMock = vi.fn(() =>
        Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'image/jpeg' }),
          arrayBuffer: () => Promise.resolve(new Uint8Array([1, 2, 3]).buffer),
        }),
      );
      vi.stubGlobal('fetch', fetchMock);

      const res = await agent
        .get(`/api/v1/collectibles/${id}/image`)
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toBe('image/jpeg');
      expect(fetchMock).toHaveBeenCalledWith(
        'https://product-images.s3.cardmarket.com/53/846734/846734.jpg',
        expect.objectContaining({
          headers: expect.objectContaining({ Referer: 'https://cardmarket.com/' }),
        }),
      );
    });

    it('returns 404 when the item has no image', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/collectibles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ itemType: 'sealed', name: 'Scellé', purchasePrice: 10000, purchaseDate: '2026-01-01' });
      const id = createRes.body.data.id as string;

      const res = await agent
        .get(`/api/v1/collectibles/${id}/image`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(404);
    });

    it('returns 502 when the upstream image fetch fails', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const createRes = await agent
        .post('/api/v1/collectibles')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          itemType: 'sealed',
          name: 'Scellé',
          purchasePrice: 10000,
          purchaseDate: '2026-01-01',
          imageUrl: 'https://example.com/broken.jpg',
        });
      const id = createRes.body.data.id as string;

      vi.stubGlobal(
        'fetch',
        vi.fn(() => Promise.resolve({ ok: false, headers: new Headers(), arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)) })),
      );

      const res = await agent
        .get(`/api/v1/collectibles/${id}/image`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(res.status).toBe(502);
    });
  });

  describe('POST /sync-prices', () => {
    it('syncs a tcgdex card, skips manual items and unconfigured providers', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();

      const [cardItem] = await db
        .insert(schema.collectibleItems)
        .values({
          userId,
          itemType: 'card',
          name: 'Dracaufeu',
          purchasePrice: 5000,
          purchaseDate: '2026-01-01',
          priceSource: 'tcgdex',
          tcgdexId: 'swsh3-136',
        })
        .returning();

      await db.insert(schema.collectibleItems).values({
        userId,
        itemType: 'sealed',
        name: 'Scellé manuel',
        purchasePrice: 10000,
        purchaseDate: '2026-01-01',
        priceSource: 'manual',
      });

      await db.insert(schema.collectibleItems).values({
        userId,
        itemType: 'sealed',
        name: 'Scellé auto sans clé',
        purchasePrice: 10000,
        purchaseDate: '2026-01-01',
        priceSource: 'pokemonpricetracker',
      });

      TCGdex.fetch = vi.fn(() =>
        Promise.resolve(
          jsonResponse({
            id: 'swsh3-136',
            name: 'Dracaufeu',
            pricing: {
              cardmarket: { trend: 12.5 },
              tcgplayer: { normal: { marketPrice: 7 } },
            },
          }),
        ),
      ) as unknown as typeof fetch;

      const res = await agent
        .post('/api/v1/collectibles/sync-prices')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      // 1 synced (tcgdex card), 1 skipped (pokemonpricetracker with no key) — the
      // manual item never enters the sync set at all.
      expect(res.body.data).toEqual({ synced: 1, skipped: 1, errors: 0 });

      const historyRes = await agent
        .get(`/api/v1/collectibles/${cardItem!.id}`)
        .set('Authorization', `Bearer ${accessToken}`);
      expect(historyRes.body.data.history[0]).toMatchObject({
        marketPriceEur: 1250,
        marketPriceUsd: 700,
        source: 'tcgdex_cardmarket',
      });
    });
  });

  describe('GET /performance', () => {
    it('computes gain/loss from the latest EUR snapshot and sorts performers', async () => {
      const { agent, accessToken, userId } = await registerAndGetToken();

      const [winner] = await db
        .insert(schema.collectibleItems)
        .values({
          userId,
          itemType: 'card',
          name: 'Winner',
          purchasePrice: 1000,
          purchaseDate: '2026-01-01',
          priceSource: 'manual',
        })
        .returning();
      const [loser] = await db
        .insert(schema.collectibleItems)
        .values({
          userId,
          itemType: 'card',
          name: 'Loser',
          purchasePrice: 1000,
          purchaseDate: '2026-01-01',
          priceSource: 'manual',
        })
        .returning();

      await db.insert(schema.collectiblePriceSnapshots).values({
        itemId: winner!.id,
        marketPriceEur: 2000,
        source: 'manual',
      });
      await db.insert(schema.collectiblePriceSnapshots).values({
        itemId: loser!.id,
        marketPriceEur: 500,
        source: 'manual',
      });

      const res = await agent
        .get('/api/v1/collectibles/performance')
        .query({ sort: 'best_performers' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.items[0].name).toBe('Winner');
      expect(res.body.data.items[0].gainLossPct).toBe(100);
      expect(res.body.data.items[1].name).toBe('Loser');
      expect(res.body.data.totals.totalInvested).toBe(2000);
      expect(res.body.data.totals.totalCurrentValue).toBe(2500);
    });
  });

  describe('GET /search/card', () => {
    it('searches TCGdex cards by name', async () => {
      const { agent, accessToken } = await registerAndGetToken();

      TCGdex.fetch = vi.fn(() =>
        Promise.resolve(
          jsonResponse([
            {
              id: 'base4-1',
              localId: '1',
              name: 'Alakazam',
              image: 'https://assets.tcgdex.net/en/base/base4/1',
            },
          ]),
        ),
      ) as unknown as typeof fetch;

      const res = await agent
        .get('/api/v1/collectibles/search/card')
        .query({ q: 'Alakazam' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([
        {
          tcgdexId: 'base4-1',
          name: 'Alakazam',
          setName: null,
          cardNumber: '1',
          imageUrl: 'https://assets.tcgdex.net/en/base/base4/1/high.webp',
        },
      ]);
    });

    it('returns no results for a non-Pokémon game — TCGdex only covers Pokémon', async () => {
      const { agent, accessToken } = await registerAndGetToken();
      const fetchMock = vi.fn(() => Promise.resolve(jsonResponse([{ id: 'should-not-be-called' }])));
      TCGdex.fetch = fetchMock as unknown as typeof fetch;

      const res = await agent
        .get('/api/v1/collectibles/search/card')
        .query({ q: 'Luffy', tcgType: 'onepiece' })
        .set('Authorization', `Bearer ${accessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([]);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
