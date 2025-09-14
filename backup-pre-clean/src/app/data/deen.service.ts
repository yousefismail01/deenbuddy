import { Injectable, computed, signal } from "@angular/core";
import { supabase } from "../core/supabase.client";
import type { DayRecord, ScoreWeights } from "./scoring.model";
import { DEFAULT_WEIGHTS } from "./scoring.model";

export interface RoundRow {
  id: string;
  user_id: string;
  title: string;
  start_date: string;
  is_active: boolean;
}

@Injectable({ providedIn: "root" })
export class DeenService {
  weights = signal<ScoreWeights>(DEFAULT_WEIGHTS);
  round = signal<RoundRow | null>(null);
  days = signal<Record<number, DayRecord>>({});

/** NEW dayScore: uses d.day for context-aware fasting.
 *  - Fardh (0–5) emphasized; Witr can be counted as obligation (toggle below).
 *  - Nafl, Duha, Qiyam in growth.
 *  - Qurʾān: unlimited points (1/page), with gentle diminishing after target (for balance).
 *  - Dhikr: 0–100 each, gentle diminishing after targetCount.
 *  - Fasting: White/Mon-Thu/Optional weights based on the specific day.
 */
private dayScore(d: DayRecord): number {
  const w = this.weights();
  const dayNum = d.day;
  const INCLUDE_WITR_IN_OBLIGATION = true; // set false if you prefer Witr as growth

  // Obligation
  const fardhPts = (d.salah.f ?? 0) * w.salah.f;           // f is numeric 0..5
  const witrPts  = (INCLUDE_WITR_IN_OBLIGATION && d.salah.w) ? w.salah.w : 0;
  const obligation = fardhPts + witrPts;

  // Growth
  const naflPts  = (d.salah.n ?? 0) * w.salah.n;           // n is numeric 0..12
  const duhaPts  = d.salah.d ? w.salah.d : 0;
  const qiyamPts = d.salah.q ? w.salah.q : 0;

  // Qurʾān: unlimited points; diminish after daily target (visual target still 4)
  const pages = d.quran.pages ?? 0;
  const quranPts = this.diminish(pages, w.quran.dailyTarget, w.quran.perPage);

  // Dhikr: each item 0..100; diminish after targetCount
  const dz = (w.dhikr.items as (keyof typeof d.dhikr)[]).reduce((t, key) => {
    const count = (d.dhikr as any)[key] ?? 0;
    return t + this.diminish(count, w.dhikr.targetCount, w.dhikr.perItem);
  }, 0);

  // Fasting: context-aware weights
  let fastPts = 0;
  if (this.isWhiteDay(dayNum)) {
    if (dayNum === 13 && d.siyam.white13) fastPts += w.siyam.white;
    if (dayNum === 14 && d.siyam.white14) fastPts += w.siyam.white;
    if (dayNum === 15 && d.siyam.white15) fastPts += w.siyam.white;
  } else if (this.isMonday(dayNum) || this.isThursday(dayNum)) {
    if (this.isMonday(dayNum)   && d.siyam.mon) fastPts += w.siyam.monThu;
    if (this.isThursday(dayNum) && d.siyam.thu) fastPts += w.siyam.monThu;
  } else {
    if (d.siyam.optional) fastPts += w.siyam.optional;
  }

  // (Optional) Sadaqah points if you’re using them
  const sadaqahPts = (d.sadaqah?.money ? w.sadaqah.money : 0) + (d.sadaqah?.kindness ? w.sadaqah.kindness : 0);

  const growth = naflPts + duhaPts + qiyamPts + quranPts + dz + fastPts + sadaqahPts;
  return obligation + growth;
}
  totalWithoutIshraq = computed(() =>
    Object.values(this.days()).reduce((t, d) => t + this.dayScore(d), 0)
  );
  ishraqTotal = computed(() => {
    const w = this.weights();
    let weeks = 0;
    for (let i = 1; i <= 40; i += 7) {
      const any = Array.from({ length: 7 }, (_, k) => this.days()[i + k])
        .filter(Boolean)
        .some((d) => d.ishraq.done);
      if (any) weeks++;
    }
    return weeks * w.ishraq.perWeek;
  });
  // grandTotal = computed(() => this.totalWithoutIshraq() + this.ishraqTotal());

  // async loadOrCreateRound(userId: string) {
  //   const { data, error } = await supabase.from('rounds')
  //     .select('*').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle();
  //   if (error) throw error;
  //   if (!data) {
  //     const { data: created, error: e2 } = await supabase.from('rounds')
  //       .insert({ user_id: userId, title: '40-Day Plan' }).select().single();
  //     if (e2) throw e2;
  //     this.round.set(created);
  //     await this.seedDays(created.id);
  //   } else {
  //     this.round.set(data);
  //   }
  //   await this.loadDays();
  // }

  private blankDay(n: number): DayRecord {
    return {
      day: n,
      salah: { f: 0, n: 0, d: false, w: false, q: false },
      siyam: {
        mon: false,
        thu: false,
        white13: false,
        white14: false,
        white15: false,
        optional: false,
      },

      sadaqah: { money: false, kindness: false },
      quran: { pages: 0 },
      dhikr: {
        astaghfirullah: 0,
        salawat: 0,
        laIlaha: 0,
        subhanallah: 0,
        alhamdulillah: 0,
        allahuAkbar: 0,
      },

      ishraq: { done: false },
    };
  }

  // UPDATE: seed uses daysInMonth and upsert (idempotent)
  private async seedDays(roundId: string, daysInMonth: number) {
    const rows = Array.from({ length: daysInMonth }, (_, i) => ({
      round_id: roundId,
      day_number: i + 1,
      data: this.blankDay(i + 1),
    }));
    await supabase.from("day_records").upsert(rows, {
      onConflict: "round_id,day_number",
      ignoreDuplicates: true,
    });
  }

  async loadDays() {
    const r = this.round();
    if (!r) return;
    const { data, error } = await supabase
      .from("day_records")
      .select("day_number, data")
      .eq("round_id", r.id)
      .order("day_number");
    if (error) throw error;
    const map: Record<number, DayRecord> = {};
    (data ?? []).forEach((x: any) => (map[x.day_number] = x.data));
    this.days.set(map);
  }

  async upsertDay(day: number, updater: (d: DayRecord) => DayRecord) {
    const r = this.round();
    if (!r) return;

    const curr = this.days()[day] ?? this.blankDay(day);
    const next = updater(structuredClone(curr));

    // optimistic UI
    this.days.update((s) => ({ ...s, [day]: next }));

    const { error } = await supabase
      .from("day_records")
      .upsert(
        { round_id: r.id, day_number: day, data: next },
        { onConflict: "round_id,day_number", ignoreDuplicates: false }
      ); // add .select() if you need the row returned

    if (error) {
      // rollback on error
      this.days.update((s) => ({ ...s, [day]: curr }));
      throw error;
    }
  }

  exportJSON() {
    const blob = new Blob(
      [JSON.stringify({ round: this.round(), days: this.days() }, null, 2)],
      { type: "application/json" }
    );
    this.download(blob, `deen-round-${this.round()?.id ?? "local"}.json`);
  }

  exportCSV() {
    const header = [
      "day",
      "f",
      "n",
      "d",
      "w",
      "q",
      "mon",
      "thu",
      "white13",
      "white14",
      "white15",
      "money",
      "kindness",
      "quran_pages",
      "astagh",
      "salawat",
      "laIlaha",
      "subhan",
      "alhamd",
      "akbar",
      "ishraq",
      "notes",
    ];
    const rows = Object.values(this.days()).map((d) =>
      [
        d.day,
        +d.salah.f,
        +d.salah.n,
        +d.salah.d,
        +d.salah.w,
        +d.salah.q,
        +d.siyam.mon,
        +d.siyam.thu,
        +d.siyam.white13,
        +d.siyam.white14,
        +d.siyam.white15,
        +d.sadaqah.money,
        +d.sadaqah.kindness,
        d.quran.pages,
        +d.dhikr.astaghfirullah,
        +d.dhikr.salawat,
        +d.dhikr.laIlaha,
        +d.dhikr.subhanallah,
        +d.dhikr.alhamdulillah,
        +d.dhikr.allahuAkbar,
        +d.ishraq.done,
        (d.notes ?? "").replaceAll(",", ";"),
      ].join(",")
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    this.download(blob, `deen-round-${this.round()?.id ?? "local"}.csv`);
  }

  private download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // src/app/data/deen.service.ts
  async ensureProfile(userId: string, displayName?: string) {
    await supabase
      .from("profiles")
      .upsert({ id: userId, display_name: displayName ?? null })
      .select();
  }

  // NEW: month context helpers
  getCurrentMonthCtx() {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 }; // 1..12
  }
  daysIn(year: number, month: number) {
    return new Date(year, month, 0).getDate(); // last day of month
  }

  // LOAD or CREATE current month period
  async loadOrCreateCurrentMonth(userId: string) {
    const { year, month } = this.getCurrentMonthCtx();
    // Try fetch
    const { data: existing, error } = await supabase
      .from("rounds")
      .select("*")
      .eq("user_id", userId)
      .eq("year", year)
      .eq("month", month)
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    if (!existing) {
      const { data: created, error: e2 } = await supabase
        .from("rounds")
        .insert({
          user_id: userId,
          title: "Monthly Plan",
          start_date: `${year}-${String(month).padStart(2, "0")}-01`,
          year,
          month,
          is_active: true,
        })
        .select()
        .single();
      if (e2) throw e2;
      this.round.set(created);
      await this.seedDays(created.id, this.daysIn(year, month)); // seed 1..daysInMonth
    } else {
      this.round.set(existing);
      // Ensure seeded rows match the month length (idempotent)
      await this.seedDays(
        existing.id,
        this.daysIn(existing.year, existing.month)
      );
    }

    await this.loadDays();
  }

  // ===== Helpers: dates for monthly context =====
dateFor(day: number) {
  const r: any = this.round();
  return new Date(r.year, r.month - 1, day);
}
isMonday(day: number){ return this.dateFor(day).getDay() === 1; }
isThursday(day: number){ return this.dateFor(day).getDay() === 4; }
isWhiteDay(day: number){ return day === 13 || day === 14 || day === 15; }

// ===== Soft-diminishing utility (no hard caps; gentler past target) =====
private diminish(x: number, target: number, perPoint: number) {
  if (x <= target) return x * perPoint;
  const extra = x - target;
  return target * perPoint + Math.sqrt(extra) * perPoint;
}

// ===== Daily score breakdown (obligation, growth, gauge, targets) =====
dayBreakdown(dayNum: number) {
  const d = this.days()[dayNum];
  const w = this.weights();
  if (!d) return { obligation:0, growth:0, total:0, gauge:0, targetObligation:0, targetGrowth:0, targetTotal:0 };

  // 1) Obligation (Fardh + optionally Witr)
  const INCLUDE_WITR_IN_OBLIGATION = true;  // flip to false if you prefer Witr as growth
  const fardhPts = (d.salah.f ?? 0) * w.salah.f;                // f is 0..5
  const witrPts  = (INCLUDE_WITR_IN_OBLIGATION && d.salah.w) ? w.salah.w : 0;
  const obligation = fardhPts + witrPts;

  // 2) Growth (Nafl, Duha, Qiyam, Qur'an, Dhikr, Fasting, Sadaqah/Ishrāq if used)
  const naflPts  = (d.salah.n ?? 0) * w.salah.n;                // 0..12
  const duhaPts  = d.salah.d ? w.salah.d : 0;
  const qiyamPts = d.salah.q ? w.salah.q : 0;

  // Qur'ān: unlimited, gentle diminishing after daily target
  const qPages = d.quran.pages ?? 0;
  const quranPts = this.diminish(qPages, w.quran.dailyTarget, w.quran.perPage);

  // Dhikr: each item 0..100, use diminish after targetCount
  const dz = (w.dhikr.items as (keyof typeof d.dhikr)[]).reduce((t,k)=>{
    const cnt = (d.dhikr as any)[k] ?? 0;
    return t + this.diminish(cnt, w.dhikr.targetCount, w.dhikr.perItem);
  }, 0);

  // Fasting (context-aware)
  let fastPts = 0;
  if (this.isWhiteDay(dayNum)) {
    if (dayNum === 13 && d.siyam.white13) fastPts += w.siyam.white;
    if (dayNum === 14 && d.siyam.white14) fastPts += w.siyam.white;
    if (dayNum === 15 && d.siyam.white15) fastPts += w.siyam.white;
  } else if (this.isMonday(dayNum) || this.isThursday(dayNum)) {
    if (this.isMonday(dayNum)  && d.siyam.mon) fastPts += w.siyam.monThu;
    if (this.isThursday(dayNum) && d.siyam.thu) fastPts += w.siyam.monThu;
  } else {
    if (d.siyam.optional) fastPts += w.siyam.optional;
  }

  // Optional: Sadaqah
  const sadaqahPts = (d.sadaqah?.money ? w.sadaqah.money : 0) + (d.sadaqah?.kindness ? w.sadaqah.kindness : 0);

  // Growth total
  const growth = naflPts + duhaPts + qiyamPts + quranPts + dz + fastPts + sadaqahPts;

// ---- 3) TARGETS for gauge (unchanged) ----
const targetObligation = (5 * w.salah.f) + (INCLUDE_WITR_IN_OBLIGATION ? w.salah.w : 0);

const targetGrowth =
  (12 * w.salah.n) +                   // Nafl 12
  w.salah.d +                          // Duha done
  w.salah.q +                          // Qiyam done
  (w.quran.dailyTarget * w.quran.perPage) + // Qur'an 4 pages (display target)
  (w.dhikr.items.length * w.dhikr.targetCount * w.dhikr.perItem) + // Dhikr 100 each
  // Fasting: day-type target (max one toggle per day)
  (this.isWhiteDay(dayNum) ? w.siyam.white
    : (this.isMonday(dayNum) || this.isThursday(dayNum)) ? w.siyam.monThu
    : w.siyam.optional) +
  // Sadaqah: treat both toggles as the "target"
  (w.sadaqah.money + w.sadaqah.kindness);

const targetTotal = targetObligation + targetGrowth;

// ---- 4) GAUGE via per-category capped contributions ----
const metObligation =
  Math.min(fardhPts, 5 * w.salah.f) +
  (INCLUDE_WITR_IN_OBLIGATION ? Math.min(witrPts, w.salah.w) : 0);

// Growth components capped at their target
const metNafl  = Math.min(naflPts, 12 * w.salah.n);
const metDuha  = Math.min(duhaPts, w.salah.d);
const metQiyam = Math.min(qiyamPts, w.salah.q);
const metQuran = Math.min((d.quran.pages ?? 0) * w.quran.perPage,
                          w.quran.dailyTarget * w.quran.perPage);
const metDhikr = (w.dhikr.items as (keyof typeof d.dhikr)[]).reduce((t,k)=>{
  const cnt = (d.dhikr as any)[k] ?? 0;
  return t + Math.min(cnt * w.dhikr.perItem, w.dhikr.targetCount * w.dhikr.perItem);
}, 0);
const metFasting =
  this.isWhiteDay(dayNum)  ? (d.siyam.white13 && dayNum===13 || d.siyam.white14 && dayNum===14 || d.siyam.white15 && dayNum===15 ? w.siyam.white : 0)
: this.isMonday(dayNum)    ? (d.siyam.mon  ? w.siyam.monThu : 0)
: this.isThursday(dayNum)  ? (d.siyam.thu  ? w.siyam.monThu : 0)
                           : (d.siyam.optional ? w.siyam.optional : 0);
const metSadaqah = (d.sadaqah?.money ? w.sadaqah.money : 0) + (d.sadaqah?.kindness ? w.sadaqah.kindness : 0);

const metGrowth = metNafl + metDuha + metQiyam + metQuran + metDhikr + metFasting + metSadaqah;

// Final numbers
const total = obligation + growth;

// exact 100 when targets met; epsilon avoids 99 due to FP noise
const eps = 1e-9;
const gauge = Math.max(0, Math.min(150, Math.round(((metObligation + metGrowth) / Math.max(targetTotal, eps) + eps) * 100)));

// return everything you were returning before:
return { obligation, growth, total, gauge, targetObligation, targetGrowth, targetTotal };
}

// ===== Monthly aggregates =====
obligationTotal = computed(() =>
  Object.keys(this.days()).reduce((t,k)=> t + this.dayBreakdown(+k).obligation, 0)
);
growthTotal = computed(() =>
  Object.keys(this.days()).reduce((t,k)=> t + this.dayBreakdown(+k).growth, 0)
);
grandTotal = computed(() => this.obligationTotal() + this.growthTotal());

// ===== Weekly bonuses =====
// +10 if ≥5 days in the week with gauge ≥60
// +10 if all 7 days in the week had fardh count = 5
weeklyBonus = computed(() => {
  const r: any = this.round(); if (!r) return 0;
  // Build weeks as Sun..Sat (or switch to Mon..Sun if you prefer)
  const daysInMonth = new Date(r.year, r.month, 0).getDate();
  const byWeek: Record<string, number[]> = {}; // key = ISO week start date string
  for (let day=1; day<=daysInMonth; day++) {
    const dt = this.dateFor(day);
    const start = new Date(dt); start.setDate(dt.getDate() - dt.getDay()); // Sunday start
    const key = `${start.getFullYear()}-${start.getMonth()+1}-${start.getDate()}`;
    (byWeek[key] ??= []).push(day);
  }
  let bonus = 0;
  for (const key of Object.keys(byWeek)) {
    const days = byWeek[key];
    const gauges = days.map(d => this.dayBreakdown(d).gauge);
    const passGauge = gauges.filter(g => g >= 60).length >= 5 ? 10 : 0;
    const fardhAll7 = days.length === 7 && days.every(d => (this.days()[d]?.salah?.f ?? 0) === 5) ? 10 : 0;
    bonus += passGauge + fardhAll7;
  }
  return bonus;
});

// Final total including bonuses
grandTotalWithBonuses = computed(() => this.grandTotal() + this.weeklyBonus());

}
