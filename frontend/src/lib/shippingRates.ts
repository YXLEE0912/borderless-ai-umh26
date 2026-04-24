export type OriginRegion = "west" | "east";

export type ShippingRateBand = "document" | "parcel" | "sea_lcl";

export type ShippingRateQuote = {
  originRegion: OriginRegion;
  rateBand: ShippingRateBand;
  rateWeightKg: number;
  shippingFee: number;
};

const WEST_MALAYSIA_DOCUMENT_RATES: Record<number, number> = {
  0.5: 64.9,
  1: 79.2,
  1.5: 93.3,
  2: 116.38,
};

const WEST_MALAYSIA_PARCEL_RATES: Record<number, number> = {
  0.5: 64.9,
  1: 79.2,
  1.5: 93.3,
  2: 116.38,
  2.5: 139.65,
  3: 167.58,
  3.5: 201.1,
  4: 216.1,
  4.5: 231.1,
  5: 246.1,
  5.5: 261.1,
  6: 276.1,
  6.5: 291.1,
  7: 306.1,
  7.5: 321.1,
  8: 336.1,
  8.5: 351.1,
  9: 366.1,
  9.5: 381.1,
  10: 396.1,
  10.5: 411.1,
  11: 426.1,
  11.5: 441.1,
  12: 456.1,
  12.5: 471.1,
  13: 486.1,
  13.5: 501.1,
  14: 516.1,
  14.5: 531.1,
  15: 546.1,
  15.5: 561.1,
  16: 576.1,
  16.5: 591.1,
  17: 606.1,
  17.5: 621.1,
  18: 636.1,
  18.5: 651.1,
  19: 666.1,
  19.5: 681.1,
  20: 696.1,
  20.5: 711.1,
  21: 726.1,
  21.5: 741.1,
  22: 756.1,
  22.5: 771.1,
  23: 786.1,
  23.5: 801.1,
  24: 816.1,
  24.5: 831.1,
  25: 846.1,
  25.5: 861.1,
  26: 876.1,
  26.5: 891.1,
  27: 906.1,
  27.5: 921.1,
  28: 936.1,
  28.5: 951.1,
  29: 966.1,
  29.5: 981.1,
  30: 996.1,
};

const EAST_MALAYSIA_DOCUMENT_RATES: Record<number, number> = {
  0.5: 77.87,
  1: 89.55,
  1.5: 107.46,
  2: 139.7,
};

const EAST_MALAYSIA_PARCEL_RATES: Record<number, number> = {
  0.5: 77.87,
  1: 89.55,
  1.5: 107.46,
  2: 139.7,
  2.5: 167.64,
  3: 201.17,
  3.5: 241.4,
  4: 261.4,
  4.5: 281.4,
  5: 301.4,
  5.5: 321.4,
  6: 341.4,
  6.5: 361.4,
  7: 381.4,
  7.5: 401.4,
  8: 421.4,
  8.5: 441.4,
  9: 461.4,
  9.5: 481.4,
  10: 501.4,
  10.5: 521.4,
  11: 541.4,
  11.5: 561.4,
  12: 581.4,
  12.5: 601.4,
  13: 621.4,
  13.5: 641.4,
  14: 661.4,
  14.5: 681.4,
  15: 701.4,
  15.5: 721.4,
  16: 741.4,
  16.5: 761.4,
  17: 781.4,
  17.5: 801.4,
  18: 821.4,
  18.5: 841.4,
  19: 861.4,
  19.5: 881.4,
  20: 901.4,
  20.5: 921.4,
  21: 941.4,
  21.5: 961.4,
  22: 981.4,
  22.5: 1001.4,
  23: 1021.4,
  23.5: 1041.4,
  24: 1061.4,
  24.5: 1081.4,
  25: 1101.4,
  25.5: 1121.4,
  26: 1141.4,
  26.5: 1161.4,
  27: 1181.4,
  27.5: 1201.4,
  28: 1221.4,
  28.5: 1241.4,
  29: 1261.4,
  29.5: 1281.4,
  30: 1301.4,
};

const SEA_MIN_CHARGEABLE_WEIGHT_KG = 20;
const SEA_MAX_TABLE_WEIGHT_KG = 32;
const SEA_WEIGHT_STEP_KG = 0.5;

const SEA_WEST_MALAYSIA_LCL_RATES: Record<number, number> = Object.fromEntries(
  Array.from({ length: ((SEA_MAX_TABLE_WEIGHT_KG - SEA_MIN_CHARGEABLE_WEIGHT_KG) / SEA_WEIGHT_STEP_KG) + 1 }, (_, index) => {
    const weight = Number((SEA_MIN_CHARGEABLE_WEIGHT_KG + (index * SEA_WEIGHT_STEP_KG)).toFixed(1));
    const price = Number((150 + (index * 3)).toFixed(2));
    return [weight, price];
  })
);

const SEA_EAST_MALAYSIA_LCL_RATES: Record<number, number> = Object.fromEntries(
  Array.from({ length: ((SEA_MAX_TABLE_WEIGHT_KG - SEA_MIN_CHARGEABLE_WEIGHT_KG) / SEA_WEIGHT_STEP_KG) + 1 }, (_, index) => {
    const weight = Number((SEA_MIN_CHARGEABLE_WEIGHT_KG + (index * SEA_WEIGHT_STEP_KG)).toFixed(1));
    const price = Number((200 + (index * 4.5)).toFixed(2));
    return [weight, price];
  })
);

export function lookupShippingRate(originRegion: OriginRegion, weightKg: number): ShippingRateQuote {
  const rateBand: ShippingRateBand = weightKg <= 2 ? "document" : "parcel";
  const roundedWeight = roundUpToHalf(weightKg);
  const table = rateBand === "document"
    ? originRegion === "east"
      ? EAST_MALAYSIA_DOCUMENT_RATES
      : WEST_MALAYSIA_DOCUMENT_RATES
    : originRegion === "east"
      ? EAST_MALAYSIA_PARCEL_RATES
      : WEST_MALAYSIA_PARCEL_RATES;

  const availableWeights = Object.keys(table).map(Number).sort((left, right) => left - right);
  const rateWeightKg = Math.min(Math.max(roundedWeight, availableWeights[0]), availableWeights[availableWeights.length - 1]);
  const shippingFee = table[rateWeightKg] ?? table[availableWeights[availableWeights.length - 1]];

  return {
    originRegion,
    rateBand,
    rateWeightKg,
    shippingFee: Number(shippingFee.toFixed(2)),
  };
}

export function lookupSeaShippingRate(originRegion: OriginRegion, weightKg: number): ShippingRateQuote {
  const roundedWeight = roundUpToHalf(weightKg);
  const rateWeightKg = Math.min(Math.max(roundedWeight, SEA_MIN_CHARGEABLE_WEIGHT_KG), SEA_MAX_TABLE_WEIGHT_KG);
  const table = originRegion === "east" ? SEA_EAST_MALAYSIA_LCL_RATES : SEA_WEST_MALAYSIA_LCL_RATES;
  const shippingFee = table[rateWeightKg] ?? table[SEA_MAX_TABLE_WEIGHT_KG];

  return {
    originRegion,
    rateBand: "sea_lcl",
    rateWeightKg,
    shippingFee: Number(shippingFee.toFixed(2)),
  };
}

export function formatShippingRateLabel(quote: ShippingRateQuote): string {
  if (quote.rateBand === "sea_lcl") {
    const regionLabel = quote.originRegion === "east" ? "East Malaysia" : "West Malaysia";
    return `${regionLabel} Sea LCL rate at ${quote.rateWeightKg.toFixed(1)} kg`;
  }
  const regionLabel = quote.originRegion === "east" ? "East Malaysia" : "West Malaysia";
  const bandLabel = quote.rateBand === "document" ? "Document" : "Parcel";
  return `${regionLabel} ${bandLabel} rate at ${quote.rateWeightKg.toFixed(1)} kg`;
}

function roundUpToHalf(weightKg: number): number {
  return Math.ceil(weightKg * 2) / 2;
}