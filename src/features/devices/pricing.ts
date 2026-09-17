import { getPriceOverride } from '@/stores/catalogEditsStore';
import type { RackProfileId } from '@/features/rack/rackProfiles';

/**
 * Indicative list prices (estimates) for the bill of materials, all held in
 * USD as the single base currency. This is the one place build pricing
 * lives — edit a number here and it flows to the cart, the device inspector
 * and the library. Prices are approximate MSRP for planning only.
 *
 * Keyed by device id, so an external metadata device that overrides a
 * built-in id (e.g. the shipped Dream Machine Pro GLB) is priced here too.
 */
export const DEVICE_PRICES_USD: Record<string, number> = {
  // Ubiquiti
  'ubnt-udm-pro': 379,
  'ubnt-usw-pro-48-poe': 1099,
  'ubnt-usw-pro-24-poe': 799,
  'ubnt-usw-pro-max-24-poe': 599,
  'ubnt-usw-pro-aggregation': 1099,
  'ubnt-unvr-pro': 799,
  'ubnt-unvr': 499,
  'ubnt-unas-pro': 499,
  'ubnt-ucg-ultra': 129,
  'ubnt-rack-shelf-1u': 49,
  'ubnt-uacc-rack-panel-brush-1u': 29,
  // APC
  'apc-smt1500rm': 899,
  'apc-ap8861': 1099,
  // Cisco
  'cisco-c9300-48p': 8995,
  'cisco-n93180': 11995,
  // Dell
  'dell-r660': 4499,
  'dell-r760': 6499,
  // HPE
  'hpe-dl380-g11': 5999,
  'hpe-dl20-g11': 2199,
  // Supermicro
  'smc-sys-121c': 3499,
  // MikroTik
  'mt-ccr2216': 2995,
  'mt-crs354': 499,
  'mt-hex-s': 69,
  // Netgear
  'ng-m4300-24x': 2999,
  'ng-m4250-26g4xf-poe': 1499,
  // Synology
  'syn-ds923': 599,
  'syn-rs1221': 1499,
  'syn-rs822': 699,
  // Genexis
  'genexis-hybrid-live-titanium': 199,
  // RackForge
  'rackforge-pdu-1u-eu': 79,
  // Generic
  'gen-ups-2u': 349,
  'gen-cable-modem': 120,
  'gen-wifi-router': 89,
  'gen-patch-24': 39,
  'gen-patch-48': 65,
  'gen-blank-1u': 8,
  'gen-brush-1u': 19,
  'gen-cable-mgmt-1u': 25,
  'gen-finger-duct-2u': 32,
  'gen-cable-ring-1u': 18,
  'gen-vertical-mgmt-4u': 45,
  'gen-cable-tray-1u': 28,
  'gen-power-raceway-1u': 35,
  'gen-patch-guide-1u': 15,
};

/** Indicative list price for each rack/enclosure profile, USD. */
export const RACK_PROFILE_PRICES_USD: Record<RackProfileId, number> = {
  'open-frame-600': 199,
  'open-frame-700': 249,
  'open-frame-800': 299,
  'cabinet-42u': 899,
  'wall-rack-9u': 179,
  'unifi-minirack': 149,
  'uacc-wall-12u': 399,
  'uacc-wall-12u-solid': 399,
  custom: 299,
};

/**
 * Unit price of a device, or undefined when we have no estimate for it.
 * A user-set override (from the library inspector) wins over the built-in
 * estimate — including an explicit 0 for a free item.
 */
export function priceForDevice(def: { id: string }): number | undefined {
  const override = getPriceOverride(def.id);
  return override ?? DEVICE_PRICES_USD[def.id];
}

/** List price of a rack profile, or undefined when unknown. */
export function priceForProfile(profileId: RackProfileId): number | undefined {
  return RACK_PROFILE_PRICES_USD[profileId];
}

export type CurrencyCode = 'USD' | 'EUR' | 'GBP';

/**
 * Display currencies. Rates are indicative conversions from the USD base —
 * the tool is an estimator, not a live FX feed — so converted totals are
 * clearly approximate. USD is the base (rate 1).
 */
export const CURRENCIES: Record<
  CurrencyCode,
  { code: CurrencyCode; symbol: string; rate: number; locale: string }
> = {
  USD: { code: 'USD', symbol: '$', rate: 1, locale: 'en-US' },
  EUR: { code: 'EUR', symbol: '€', rate: 0.92, locale: 'de-DE' },
  GBP: { code: 'GBP', symbol: '£', rate: 0.79, locale: 'en-GB' },
};

/** Format a USD amount into the chosen display currency (whole units). */
export function formatMoney(usd: number, currency: CurrencyCode): string {
  const c = CURRENCIES[currency];
  return new Intl.NumberFormat(c.locale, {
    style: 'currency',
    currency: c.code,
    maximumFractionDigits: 0,
  }).format(usd * c.rate);
}
