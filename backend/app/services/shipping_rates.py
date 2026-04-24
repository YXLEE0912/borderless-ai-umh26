from __future__ import annotations

from dataclasses import dataclass
from math import ceil

from app.schemas.cost import OriginRegion


@dataclass(frozen=True)
class ShippingRateQuote:
    origin_region: OriginRegion
    rate_band: str
    rate_weight_kg: float
    shipping_fee: float


WEST_MALAYSIA_DOCUMENT_RATES = {
    0.5: 64.90,
    1.0: 79.20,
    1.5: 93.30,
    2.0: 116.38,
}

WEST_MALAYSIA_PARCEL_RATES = {
    0.5: 64.90,
    1.0: 79.20,
    1.5: 93.30,
    2.0: 116.38,
    2.5: 139.65,
    3.0: 167.58,
    3.5: 201.10,
    4.0: 216.10,
    4.5: 231.10,
    5.0: 246.10,
    5.5: 261.10,
    6.0: 276.10,
    6.5: 291.10,
    7.0: 306.10,
    7.5: 321.10,
    8.0: 336.10,
    8.5: 351.10,
    9.0: 366.10,
    9.5: 381.10,
    10.0: 396.10,
    10.5: 411.10,
    11.0: 426.10,
    11.5: 441.10,
    12.0: 456.10,
    12.5: 471.10,
    13.0: 486.10,
    13.5: 501.10,
    14.0: 516.10,
    14.5: 531.10,
    15.0: 546.10,
    15.5: 561.10,
    16.0: 576.10,
    16.5: 591.10,
    17.0: 606.10,
    17.5: 621.10,
    18.0: 636.10,
    18.5: 651.10,
    19.0: 666.10,
    19.5: 681.10,
    20.0: 696.10,
    20.5: 711.10,
    21.0: 726.10,
    21.5: 741.10,
    22.0: 756.10,
    22.5: 771.10,
    23.0: 786.10,
    23.5: 801.10,
    24.0: 816.10,
    24.5: 831.10,
    25.0: 846.10,
    25.5: 861.10,
    26.0: 876.10,
    26.5: 891.10,
    27.0: 906.10,
    27.5: 921.10,
    28.0: 936.10,
    28.5: 951.10,
    29.0: 966.10,
    29.5: 981.10,
    30.0: 996.10,
}

EAST_MALAYSIA_DOCUMENT_RATES = {
    0.5: 77.87,
    1.0: 89.55,
    1.5: 107.46,
    2.0: 139.70,
}

EAST_MALAYSIA_PARCEL_RATES = {
    0.5: 77.87,
    1.0: 89.55,
    1.5: 107.46,
    2.0: 139.70,
    2.5: 167.64,
    3.0: 201.17,
    3.5: 241.40,
    4.0: 261.40,
    4.5: 281.40,
    5.0: 301.40,
    5.5: 321.40,
    6.0: 341.40,
    6.5: 361.40,
    7.0: 381.40,
    7.5: 401.40,
    8.0: 421.40,
    8.5: 441.40,
    9.0: 461.40,
    9.5: 481.40,
    10.0: 501.40,
    10.5: 521.40,
    11.0: 541.40,
    11.5: 561.40,
    12.0: 581.40,
    12.5: 601.40,
    13.0: 621.40,
    13.5: 641.40,
    14.0: 661.40,
    14.5: 681.40,
    15.0: 701.40,
    15.5: 721.40,
    16.0: 741.40,
    16.5: 761.40,
    17.0: 781.40,
    17.5: 801.40,
    18.0: 821.40,
    18.5: 841.40,
    19.0: 861.40,
    19.5: 881.40,
    20.0: 901.40,
    20.5: 921.40,
    21.0: 941.40,
    21.5: 961.40,
    22.0: 981.40,
    22.5: 1001.40,
    23.0: 1021.40,
    23.5: 1041.40,
    24.0: 1061.40,
    24.5: 1081.40,
    25.0: 1101.40,
    25.5: 1121.40,
    26.0: 1141.40,
    26.5: 1161.40,
    27.0: 1181.40,
    27.5: 1201.40,
    28.0: 1221.40,
    28.5: 1241.40,
    29.0: 1261.40,
    29.5: 1281.40,
    30.0: 1301.40,
}


def quote_shipping_rate(origin_region: OriginRegion | str, weight_kg: float) -> ShippingRateQuote:
    region = OriginRegion(origin_region)
    weight_band = _weight_band(weight_kg)
    rounded_weight = _round_up_to_half(weight_kg)
    rate_table = _rate_table(region, weight_band)
    if not rate_table:
        raise ValueError("No shipping rates configured")

    rate_weight = min(max(rounded_weight, min(rate_table)), max(rate_table))
    shipping_fee = rate_table[rate_weight]
    return ShippingRateQuote(
        origin_region=region,
        rate_band=weight_band,
        rate_weight_kg=rate_weight,
        shipping_fee=round(shipping_fee, 2),
    )


SEA_MIN_CHARGEABLE_WEIGHT_KG = 20.0
SEA_MAX_TABLE_WEIGHT_KG = 32.0
SEA_WEIGHT_STEP_KG = 0.5


SEA_WEST_MALAYSIA_LCL_RATES = {
    round(20.0 + (index * SEA_WEIGHT_STEP_KG), 1): round(150.0 + (index * 3.0), 2)
    for index in range(int((SEA_MAX_TABLE_WEIGHT_KG - SEA_MIN_CHARGEABLE_WEIGHT_KG) / SEA_WEIGHT_STEP_KG) + 1)
}

SEA_EAST_MALAYSIA_LCL_RATES = {
    round(20.0 + (index * SEA_WEIGHT_STEP_KG), 1): round(200.0 + (index * 4.5), 2)
    for index in range(int((SEA_MAX_TABLE_WEIGHT_KG - SEA_MIN_CHARGEABLE_WEIGHT_KG) / SEA_WEIGHT_STEP_KG) + 1)
}


def quote_sea_shipping_rate(origin_region: OriginRegion | str, weight_kg: float) -> ShippingRateQuote:
    region = OriginRegion(origin_region)
    rounded_weight = _round_up_to_half(weight_kg)
    billable_weight = min(max(rounded_weight, SEA_MIN_CHARGEABLE_WEIGHT_KG), SEA_MAX_TABLE_WEIGHT_KG)
    table = SEA_EAST_MALAYSIA_LCL_RATES if region == OriginRegion.east else SEA_WEST_MALAYSIA_LCL_RATES
    shipping_fee = table[billable_weight]
    return ShippingRateQuote(
        origin_region=region,
        rate_band="sea_lcl",
        rate_weight_kg=billable_weight,
        shipping_fee=round(shipping_fee, 2),
    )


def _weight_band(weight_kg: float) -> str:
    return "document" if weight_kg <= 2.0 else "parcel"


def _round_up_to_half(weight_kg: float) -> float:
    return round(ceil(weight_kg * 2.0) / 2.0, 2)


def _rate_table(region: OriginRegion, weight_band: str) -> dict[float, float]:
    if region == OriginRegion.east:
        return EAST_MALAYSIA_DOCUMENT_RATES if weight_band == "document" else EAST_MALAYSIA_PARCEL_RATES
    return WEST_MALAYSIA_DOCUMENT_RATES if weight_band == "document" else WEST_MALAYSIA_PARCEL_RATES