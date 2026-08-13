/** Camel-case API field name -> DB key stored in `app_settings.key`. */
export const SETTINGS_FIELDS = {
  etherscanApiKey: 'etherscan_api_key',
  cryptoComApiKey: 'crypto_com_api_key',
  cryptoComApiSecret: 'crypto_com_api_secret',
  pokemonPriceTrackerApiKey: 'pokemon_price_tracker_api_key',
  poketraceApiKey: 'poketrace_api_key',
  revolutClientId: 'revolut_client_id',
  revolutClientSecret: 'revolut_client_secret',
  alphaVantageApiKey: 'alpha_vantage_api_key',
  binanceApiKey: 'binance_api_key',
  binanceApiSecret: 'binance_api_secret',
  bybitApiKey: 'bybit_api_key',
  bybitApiSecret: 'bybit_api_secret',
  meriaApiKey: 'meria_api_key',
  coingeckoApiKey: 'coingecko_api_key',
} as const;

export type SettingsField = keyof typeof SETTINGS_FIELDS;
