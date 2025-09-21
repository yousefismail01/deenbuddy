import { Injectable, computed, signal } from "@angular/core";
import type { DayRecord, RoundRow, ScoreWeights } from "../domain/deen-types";
import { DEFAULT_WEIGHTS } from "../domain/deen-types";
import { dayBreakdown, makeDate } from "../domain/scoring";

@Injectable({ providedIn: "root" })
export class DeenStore {
  // Signals
  weights = signal<ScoreWeights>(DEFAULT_WEIGHTS);
  round = signal<RoundRow | null>(null);
  days = signal<Record<number, DayRecord>>({});

  // Helpers
  daysIn(year: number, month: number) {
    return new Date(year, month, 0).getDate();
  }
  getCurrentMonthCtx() {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }
  dateFor(day: number) {
    const r = this.round();
    if (!r) return new Date();
    return makeDate(r.year, r.month, day);
  }

  // Derived
  obligationTotal = computed(() =>
    Object.keys(this.days()).reduce(
      (t, k) => t + this.dayBreakdown(+k).obligation,
      0
    )
  );
  growthTotal = computed(() =>
    Object.keys(this.days()).reduce(
      (t, k) => t + this.dayBreakdown(+k).growth,
      0
    )
  );
  grandTotal = computed(() => this.obligationTotal() + this.growthTotal());

  weeklyBonus = computed(() => {
    const r = this.round();
    if (!r) return 0;
    const daysInMonth = this.daysIn(r.year, r.month);
    const byWeek: Record<string, number[]> = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dt = this.dateFor(day);
      const start = new Date(dt);
      start.setDate(dt.getDate() - dt.getDay()); // Sunday start
      const key = `${start.getFullYear()}-${
        start.getMonth() + 1
      }-${start.getDate()}`;
      (byWeek[key] ??= []).push(day);
    }
    let bonus = 0;
    for (const key of Object.keys(byWeek)) {
      const days = byWeek[key];
      const gauges = days.map((d) => this.dayBreakdown(d).gauge);
      const passGauge = gauges.filter((g) => g >= 60).length >= 5 ? 10 : 0;
      const fardhAll7 =
        days.length === 7 &&
        days.every((d) => (this.days()[d]?.salah?.f ?? 0) === 5)
          ? 10
          : 0;
      bonus += passGauge + fardhAll7;
    }
    return bonus;
  });

  grandTotalWithBonuses = computed(
    () => this.grandTotal() + this.weeklyBonus()
  );

  dayBreakdown(dayNum: number) {
    const r = this.round();
    return dayBreakdown(
      this.days()[dayNum],
      this.weights(),
      r?.year ?? 2000,
      r?.month ?? 1,
      true
    );
  }
}
