// Money formatting helper. Uses Intl.NumberFormat to render the correct
// currency symbol per ISO 4217 code. Defaults to CRC (Costa Rican colón).
export function formatMoney(value: number, currency = "CRC"): string {
  try {
    return new Intl.NumberFormat("es-CR", {
      style: "currency",
      currency,
      // Two decimals everywhere — the DB column is NUMERIC(10,2). Some
      // currencies (CRC) default to 0 fraction digits in the locale; we
      // force 2 for consistency with the stored precision.
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    // Fallback if the currency code is unknown to the runtime
    return `${currency} ${value.toFixed(2)}`;
  }
}
