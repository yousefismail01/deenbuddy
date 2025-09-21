import { Injectable } from "@angular/core";
import type { DayRecord, StudentProfile } from "../domain/deen-types";
import { DeenRepo } from "../data/deen.repo";
import { DeenStore } from "../state/deen.store";
import { clampDay } from "../domain/scoring";

@Injectable({ providedIn: "root" })
export class DeenService {
  constructor(public store: DeenStore, private repo: DeenRepo) {}

  // Signals (so templates that did deen.weights(), deen.round(), deen.days() still work)
  weights = this.store.weights;
  round = this.store.round;
  days = this.store.days;

  // Derived totals/gauge (pass-throughs)
  obligationTotal = this.store.obligationTotal;
  growthTotal = this.store.growthTotal;
  grandTotal = this.store.grandTotal;
  weeklyBonus = this.store.weeklyBonus;
  grandTotalWithBonuses = this.store.grandTotalWithBonuses;

  dayBreakdown(day: number) {
    return this.store.dayBreakdown(day);
  }
  dateFor(day: number) {
    return this.store.dateFor(day);
  }
  daysIn(year: number, month: number) {
    return this.store.daysIn(year, month);
  }
  getCurrentMonthCtx() {
    return this.store.getCurrentMonthCtx();
  }

  // -------- Profiles / auth --------
  ensureProfile(displayName?: string) {
    return this.repo.ensureProfile(displayName);
  }
  listMyStudents() {
    return this.repo.listMyStudents();
  }
  linkStudentByCode(code: string) {
    return this.repo.linkStudentByCode(code);
  }

  // -------- Rounds / month loading --------
  async loadOrCreateCurrentMonth() {
    const uid = await this.repo.getUid();
    const { year, month } = this.store.getCurrentMonthCtx();

    const round = await this.repo.getOrCreateRound(uid, year, month);
    this.store.round.set(round);

    await this.repo.seedDays(
      round.id,
      this.store.daysIn(year, month),
      this.blankDay
    );
    const rows = await this.repo.loadDayRecords(round.id);

    const map: Record<number, DayRecord> = {};
    rows.forEach((x: any) => (map[x.day_number] = x.data));
    this.store.days.set(map);
  }

  async loadUserMonth(userId: string, year: number, month: number) {
    const r = await this.repo.getOrCreateRound(userId, year, month);
    this.store.round.set(r);
    await this.repo.seedDays(
      r.id,
      this.store.daysIn(year, month),
      this.blankDay
    );
    const rows = await this.repo.loadDayRecords(r.id);
    const map: Record<number, DayRecord> = {};
    rows.forEach((x: any) => (map[x.day_number] = x.data));
    this.store.days.set(map);
  }

  listMonths(userId: string) {
    return this.repo.listMonths(userId);
  }

  // -------- Day editing --------
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

  async upsertDay(day: number, updater: (d: DayRecord) => DayRecord) {
    const r = this.store.round();
    if (!r) return;

    const prev = this.store.days()[day] ?? this.blankDay(day);
    const next = clampDay(updater(structuredClone(prev)));

    // optimistic
    this.store.days.update((s) => ({ ...s, [day]: next }));

    try {
      const ret = await this.repo.upsertDay(r.id, day, next);
      if (ret?.data) {
        this.store.days.update((s) => ({ ...s, [day]: ret.data as DayRecord }));
      }
    } catch (err) {
      // rollback
      this.store.days.update((s) => ({ ...s, [day]: prev }));
      throw err;
    }
  }

  // -------- Export helpers (unchanged) --------
  exportJSON() {
    const blob = new Blob(
      [
        JSON.stringify(
          { round: this.store.round(), days: this.store.days() },
          null,
          2
        ),
      ],
      { type: "application/json" }
    );
    this.download(blob, `deen-round-${this.store.round()?.id ?? "local"}.json`);
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
    const rows = Object.values(this.store.days()).map((d) =>
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
    this.download(blob, `deen-round-${this.store.round()?.id ?? "local"}.csv`);
  }
  private download(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
}
