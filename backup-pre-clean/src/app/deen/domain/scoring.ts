import type { DayRecord, ScoreWeights } from "./deen-types";

// ----- Date helpers (pure) -----
export function isWhiteDay(day: number) { return day === 13 || day === 14 || day === 15; }
export function makeDate(year: number, month1to12: number, day: number) {
  return new Date(year, month1to12 - 1, day);
}
export function weekdayIndex(year: number, month1to12: number, day: number) {
  return makeDate(year, month1to12, day).getDay(); // 0 Sun .. 6 Sat
}
export function isMonday(year: number, month1to12: number, day: number) {
  return weekdayIndex(year, month1to12, day) === 1;
}
export function isThursday(year: number, month1to12: number, day: number) {
  return weekdayIndex(year, month1to12, day) === 4;
}

// ----- Utility -----
export function clamp(n: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, Math.floor(n ?? 0))); }
export function diminish(x: number, target: number, perPoint: number) {
  if (x <= target) return x * perPoint;
  const extra = x - target;
  return target * perPoint + Math.sqrt(extra) * perPoint;
}

// ----- Clamp a DayRecord safely -----
export function clampDay(d: DayRecord): DayRecord {
  return {
    ...d,
    salah: {
      f: clamp(d.salah?.f ?? 0, 0, 5),
      n: clamp(d.salah?.n ?? 0, 0, 12),
      d: !!d.salah?.d, w: !!d.salah?.w, q: !!d.salah?.q,
    },
    quran: { pages: Math.max(0, Math.floor(d.quran?.pages ?? 0)) },
    dhikr: {
      astaghfirullah: clamp(d.dhikr?.astaghfirullah ?? 0, 0, 100),
      salawat:        clamp(d.dhikr?.salawat ?? 0, 0, 100),
      laIlaha:        clamp(d.dhikr?.laIlaha ?? 0, 0, 100),
      subhanallah:    clamp(d.dhikr?.subhanallah ?? 0, 0, 100),
      alhamdulillah:  clamp(d.dhikr?.alhamdulillah ?? 0, 0, 100),
      allahuAkbar:    clamp(d.dhikr?.allahuAkbar ?? 0, 0, 100),
    },
    siyam: {
      mon: !!d.siyam?.mon, thu: !!d.siyam?.thu,
      white13: !!d.siyam?.white13, white14: !!d.siyam?.white14, white15: !!d.siyam?.white15,
      optional: !!d.siyam?.optional,
    },
    sadaqah: { money: !!d.sadaqah?.money, kindness: !!d.sadaqah?.kindness },
    ishraq: { done: !!d.ishraq?.done },
  };
}

// ----- Scoring for a single day (pure) -----
export function scoreDay(
  d: DayRecord,
  w: ScoreWeights,
  year: number,
  month1to12: number,
  includeWitrInObligation = true
) {
  const fardhPts = (d.salah.f ?? 0) * w.salah.f;
  const witrPts  = includeWitrInObligation && d.salah.w ? w.salah.w : 0;
  const obligation = fardhPts + witrPts;

  const naflPts  = (d.salah.n ?? 0) * w.salah.n;
  const duhaPts  = d.salah.d ? w.salah.d : 0;
  const qiyamPts = d.salah.q ? w.salah.q : 0;

  const quranPts = diminish(d.quran.pages ?? 0, w.quran.dailyTarget, w.quran.perPage);

  const dz = (w.dhikr.items as (keyof typeof d.dhikr)[])
    .reduce((t, key) => t + diminish((d.dhikr as any)[key] ?? 0, w.dhikr.targetCount, w.dhikr.perItem), 0);

  let fastPts = 0;
  const day = d.day;
  if (isWhiteDay(day)) {
    if (day === 13 && d.siyam.white13) fastPts += w.siyam.white;
    if (day === 14 && d.siyam.white14) fastPts += w.siyam.white;
    if (day === 15 && d.siyam.white15) fastPts += w.siyam.white;
  } else if (isMonday(year, month1to12, day) || isThursday(year, month1to12, day)) {
    if (isMonday(year, month1to12, day) && d.siyam.mon) fastPts += w.siyam.monThu;
    if (isThursday(year, month1to12, day) && d.siyam.thu) fastPts += w.siyam.monThu;
  } else {
    if (d.siyam.optional) fastPts += w.siyam.optional;
  }

  const sadaqahPts = (d.sadaqah?.money ? w.sadaqah.money : 0) + (d.sadaqah?.kindness ? w.sadaqah.kindness : 0);

  const growth = naflPts + duhaPts + qiyamPts + quranPts + dz + fastPts + sadaqahPts;
  return { obligation, growth, total: obligation + growth };
}

// ----- Gauge & targets (pure) -----
export function dayBreakdown(
  d: DayRecord | undefined,
  w: ScoreWeights,
  year: number,
  month1to12: number,
  includeWitrInObligation = true
) {
  if (!d) return {
    obligation: 0, growth: 0, total: 0, gauge: 0,
    targetObligation: 0, targetGrowth: 0, targetTotal: 0
  };

  const s = scoreDay(d, w, year, month1to12, includeWitrInObligation);

  const targetObligation = 5 * w.salah.f + (includeWitrInObligation ? w.salah.w : 0);
  const targetGrowth =
    12 * w.salah.n +
    w.salah.d + w.salah.q +
    w.quran.dailyTarget * w.quran.perPage +
    w.dhikr.items.length * w.dhikr.targetCount * w.dhikr.perItem +
    (isWhiteDay(d.day)
      ? w.siyam.white
      : (isMonday(year, month1to12, d.day) || isThursday(year, month1to12, d.day))
      ? w.siyam.monThu
      : w.siyam.optional) +
    (w.sadaqah.money + w.sadaqah.kindness);

  const targetTotal = targetObligation + targetGrowth;

  const fardhPts = (d.salah.f ?? 0) * w.salah.f;
  const witrPts  = includeWitrInObligation && d.salah.w ? w.salah.w : 0;
  const metObligation =
    Math.min(fardhPts, 5 * w.salah.f) + (includeWitrInObligation ? Math.min(witrPts, w.salah.w) : 0);

  const metNafl = Math.min((d.salah.n ?? 0) * w.salah.n, 12 * w.salah.n);
  const metDuha = Math.min(d.salah.d ? w.salah.d : 0, w.salah.d);
  const metQiyam = Math.min(d.salah.q ? w.salah.q : 0, w.salah.q);

  const metQuran = Math.min((d.quran.pages ?? 0) * w.quran.perPage, w.quran.dailyTarget * w.quran.perPage);

  const metDhikr = (w.dhikr.items as (keyof typeof d.dhikr)[])
    .reduce((t, k) => t + Math.min(((d.dhikr as any)[k] ?? 0) * w.dhikr.perItem, w.dhikr.targetCount * w.dhikr.perItem), 0);

  const metFasting = isWhiteDay(d.day)
    ? ((d.siyam.white13 && d.day === 13) || (d.siyam.white14 && d.day === 14) || (d.siyam.white15 && d.day === 15)) ? w.siyam.white : 0
    : isMonday(year, month1to12, d.day)
      ? (d.siyam.mon ? w.siyam.monThu : 0)
      : isThursday(year, month1to12, d.day)
        ? (d.siyam.thu ? w.siyam.monThu : 0)
        : (d.siyam.optional ? w.siyam.optional : 0);

  const metSadaqah = (d.sadaqah?.money ? w.sadaqah.money : 0) + (d.sadaqah?.kindness ? w.sadaqah.kindness : 0);

  const metGrowth = metNafl + metDuha + metQiyam + metQuran + metDhikr + metFasting + metSadaqah;

  const eps = 1e-9;
  const gauge = Math.max(0, Math.min(150, Math.round(((metObligation + metGrowth) / Math.max(targetTotal, eps) + eps) * 100)));

  return { ...s, gauge, targetObligation, targetGrowth, targetTotal };
}
