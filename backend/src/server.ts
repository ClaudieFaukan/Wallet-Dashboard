import { createApp } from './app.js';
import { env } from './config/env.js';
import { scheduleCollectiblesSync } from './modules/collectibles/collectibles.cron.js';
import { scheduleExchangeRatesSync } from './modules/exchange-rates/exchange-rates.cron.js';

const app = createApp();

app.listen(env.PORT, () => {
  console.log(`backend listening on port ${env.PORT}`);
});

scheduleCollectiblesSync();
scheduleExchangeRatesSync();
