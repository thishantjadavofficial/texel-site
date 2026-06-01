export interface DesignItem {
  id: string;
  title: string;
  tags: string[];
  basePrice: number; // in USD
  maxDiscountPct: number; // e.g. 20 for 20%
  designerId: string;
  previewUrl: string;
}

export interface PricingBreakdownItem {
  designId: string;
  title: string;
  basePriceUSD: number;
  basePriceINR: number;
  appliedDiscountPct: number;
  discountAmountUSD: number;
  discountAmountINR: number;
  finalPriceUSD: number;
  finalPriceINR: number;
  designerShareUSD: number;
  designerShareINR: number;
}

export interface PricingEngineResult {
  totalBasePriceUSD: number;
  totalBasePriceINR: number;
  platformDiscountPct: number; // e.g. 15 for 15%
  targetDiscountAmountUSD: number;
  targetDiscountAmountINR: number;
  designerDiscountsTotalUSD: number;
  designerDiscountsTotalINR: number;
  platformAbsorbedUSD: number;
  platformAbsorbedINR: number;
  finalGrandTotalUSD: number;
  finalGrandTotalINR: number;
  breakdown: PricingBreakdownItem[];
}

export const CURRENCY_DETAILS: Record<string, { symbol: string; name: string }> = {
  USD: { symbol: '$', name: 'USD' },
  INR: { symbol: '₹', name: 'INR' },
  EUR: { symbol: '€', name: 'EUR' },
  GBP: { symbol: '£', name: 'GBP' },
  JPY: { symbol: '¥', name: 'JPY' }
};

export function convertUSD(amountUSD: number, targetCurrency: string, rates: Record<string, number>): number {
  const rate = rates[targetCurrency] || 1.0;
  return amountUSD * rate;
}

export function formatCurrencyValue(amountUSD: number, targetCurrency: string, rates: Record<string, number>): string {
  const converted = convertUSD(amountUSD, targetCurrency, rates);
  const symbol = CURRENCY_DETAILS[targetCurrency]?.symbol || '$';
  return `${symbol}${converted.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const USD_TO_INR_RATE = 83.0;

export function convertUSDToINR(usd: number): number {
  return usd * USD_TO_INR_RATE;
}

export function getPlatformDiscountPercentage(count: number): number {
  if (count <= 1) return 0;
  if (count === 2) return 5;
  if (count === 3) return 8;
  if (count === 4) return 12;
  return 15; // 5 or more items
}

/**
 * Equal Sacrifice Dynamic Pricing Algorithm
 * 
 * Distributes the volume discount across designers based on their maximum acceptable discount limit.
 * Shortfalls are recursively distributed to other designers.
 * If all designers hit their limits, the platform absorbs the remaining discount burden.
 */
export function calculateBulkPricing(items: DesignItem[]): PricingEngineResult {
  const totalBasePriceUSD = items.reduce((sum, item) => sum + item.basePrice, 0);
  const totalBasePriceINR = convertUSDToINR(totalBasePriceUSD);
  
  const platformDiscountPct = getPlatformDiscountPercentage(items.length);
  const targetDiscountAmountUSD = totalBasePriceUSD * (platformDiscountPct / 100);
  const targetDiscountAmountINR = convertUSDToINR(targetDiscountAmountUSD);

  // Initialize individual discounts
  const finalDiscountsUSD: Record<string, number> = {};
  items.forEach(item => {
    finalDiscountsUSD[item.id] = 0;
  });

  if (platformDiscountPct > 0 && items.length > 0) {
    let remainingToAllocate = targetDiscountAmountUSD;
    const activeItems = new Set<string>(items.map(item => item.id));

    // Iteratively allocate remaining discount
    while (remainingToAllocate > 0.001 && activeItems.size > 0) {
      const activeTotalBaseUSD = items
        .filter(item => activeItems.has(item.id))
        .reduce((sum, item) => sum + item.basePrice, 0);

      if (activeTotalBaseUSD <= 0) break;

      const rateToAllocate = remainingToAllocate / activeTotalBaseUSD;
      let newRemainingToAllocate = 0;
      const itemsToCapping = new Set<string>();

      // Apply tentative discounts for this iteration
      items.forEach(item => {
        if (!activeItems.has(item.id)) return;

        const additionalDiscount = item.basePrice * rateToAllocate;
        const currentDiscount = finalDiscountsUSD[item.id];
        const prospectiveDiscount = currentDiscount + additionalDiscount;
        const maxDiscountUSD = item.basePrice * (item.maxDiscountPct / 100);

        if (prospectiveDiscount >= maxDiscountUSD - 0.001) {
          // Cap reached
          finalDiscountsUSD[item.id] = maxDiscountUSD;
          const overflow = prospectiveDiscount - maxDiscountUSD;
          newRemainingToAllocate += overflow;
          itemsToCapping.add(item.id);
        } else {
          // Under cap
          finalDiscountsUSD[item.id] = prospectiveDiscount;
        }
      });

      // Remove capped items from the active pool for the next iteration
      itemsToCapping.forEach(id => activeItems.delete(id));
      remainingToAllocate = newRemainingToAllocate;
    }

    // Remaining unallocated discount (if any, after all caps hit) is platform absorbed
    // Keep it exactly to 2 decimal places to avoid float bugs
  }

  const designerDiscountsTotalUSD = Object.values(finalDiscountsUSD).reduce((sum, d) => sum + d, 0);
  const designerDiscountsTotalINR = convertUSDToINR(designerDiscountsTotalUSD);

  // Platform absorbed portion
  const rawPlatformAbsorbedUSD = Math.max(0, targetDiscountAmountUSD - designerDiscountsTotalUSD);
  // Round all values to 2 decimal places for clean commercial rendering
  const platformAbsorbedUSD = Math.round(rawPlatformAbsorbedUSD * 100) / 100;
  const platformAbsorbedINR = convertUSDToINR(platformAbsorbedUSD);

  const finalGrandTotalUSD = Math.max(0, totalBasePriceUSD - targetDiscountAmountUSD);
  const finalGrandTotalINR = convertUSDToINR(finalGrandTotalUSD);

  const breakdown: PricingBreakdownItem[] = items.map(item => {
    const discountUSD = finalDiscountsUSD[item.id] || 0;
    const finalPriceUSD = item.basePrice - discountUSD;
    const appliedPct = item.basePrice > 0 ? (discountUSD / item.basePrice) * 100 : 0;
    
    return {
      designId: item.id,
      title: item.title,
      basePriceUSD: item.basePrice,
      basePriceINR: convertUSDToINR(item.basePrice),
      appliedDiscountPct: Math.round(appliedPct * 100) / 100,
      discountAmountUSD: Math.round(discountUSD * 100) / 100,
      discountAmountINR: convertUSDToINR(Math.round(discountUSD * 100) / 100),
      finalPriceUSD: Math.round(finalPriceUSD * 100) / 100,
      finalPriceINR: convertUSDToINR(Math.round(finalPriceUSD * 100) / 100),
      // Designer receives base price minus the discount hit they absorbed
      designerShareUSD: Math.round((item.basePrice - discountUSD) * 100) / 100,
      designerShareINR: convertUSDToINR(Math.round((item.basePrice - discountUSD) * 100) / 100)
    };
  });

  return {
    totalBasePriceUSD: Math.round(totalBasePriceUSD * 100) / 100,
    totalBasePriceINR: Math.round(totalBasePriceINR * 100) / 100,
    platformDiscountPct,
    targetDiscountAmountUSD: Math.round(targetDiscountAmountUSD * 100) / 100,
    targetDiscountAmountINR: Math.round(targetDiscountAmountINR * 100) / 100,
    designerDiscountsTotalUSD: Math.round(designerDiscountsTotalUSD * 100) / 100,
    designerDiscountsTotalINR: Math.round(designerDiscountsTotalINR * 100) / 100,
    platformAbsorbedUSD,
    platformAbsorbedINR,
    finalGrandTotalUSD: Math.round(finalGrandTotalUSD * 100) / 100,
    finalGrandTotalINR: Math.round(finalGrandTotalINR * 100) / 100,
    breakdown
  };
}
