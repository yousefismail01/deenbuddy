import { Component, computed, OnInit, signal } from "@angular/core";
import { CommonModule } from "@angular/common";
import { DeenService } from "../../data/deen.service";
import { AuthService } from "../../core/auth.service";
import { Dhikr } from "src/app/data/scoring.model";
import { RouterLink } from "@angular/router";
import type { Sadaqah } from "../../data/scoring.model";

@Component({
  standalone: true,
  selector: "app-dashboard",
  imports: [CommonModule, RouterLink],
  templateUrl: "./dashboard.component.html",
})
export class DashboardComponent implements OnInit {
  loading = true;
  today = new Date();
  expandedDay = signal<number | null>(null); // ← which day is expanded

  todayDay = new Date().getDate(); // e.g., 1..31

  dhikrKeys: ReadonlyArray<keyof Dhikr> = [
    "astaghfirullah",
    "salawat",
    "laIlaha",
    "subhanallah",
    "alhamdulillah",
    "allahuAkbar",
  ];

  constructor(public deen: DeenService, private auth: AuthService) {}

  async ngOnInit() {
    await this.auth.ensureLoaded();
    const uid = this.auth.userId!;
    await this.deen.ensureProfile(uid);
    await this.deen.loadOrCreateCurrentMonth(uid); // <-- monthly mode
    this.loading = false;
  }

  // How many days does this month have?
  daysArr = computed(() => {
    const r: any = this.deen.round();
    if (!r) return [];
    const days = this.deen.daysIn(r.year, r.month);
    return Array.from({ length: days }, (_, i) => i + 1);
  });

  // Disable future days for the current calendar month
  isFuture(day: number) {
    const r: any = this.deen.round();
    if (!r) return true;
    const isCurrentMonth =
      r.year === this.today.getFullYear() &&
      r.month === this.today.getMonth() + 1;
    if (!isCurrentMonth) return false; // (if you later add navigation, you might lock other future months too)
    return day > this.today.getDate();
  }

  // Toggle helpers (unchanged; just pass 'day' into them)
  toggleKey(day: number, path: string[]) {
    if (this.isFuture(day)) return;
    this.deen.upsertDay(day, (d) => {
      const next: any = structuredClone(d);
      let obj = next;
      for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
      obj[path[path.length - 1]] = !obj[path[path.length - 1]];
      return next;
    });
  }

  openDay(n: number) {
    if (this.isFuture(n)) return;
    this.expandedDay.set(n);
    // optional: scroll to top
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  closeExpanded() {
    this.expandedDay.set(null);
  }

  // Control helpers for expanded inputs
  setFardh(n: number, v: number) {
    if (this.isFuture(n)) return;
    const clamped = Math.max(0, Math.min(5, Math.floor(v)));
    this.deen.upsertDay(n, (d) => ({
      ...d,
      salah: { ...d.salah, f: clamped },
    }));
  }
  incFardh(n: number, delta: number) {
    const curr = this.deen.days()[n]?.salah?.f ?? 0;
    this.setFardh(n, curr + delta);
  }

  setNafl(n: number, v: number) {
    if (this.isFuture(n)) return;
    const clamped = Math.max(0, Math.min(12, Math.floor(v)));
    this.deen.upsertDay(n, (d) => ({
      ...d,
      salah: { ...d.salah, n: clamped },
    }));
  }
  incNafl(n: number, delta: number) {
    const curr = this.deen.days()[n]?.salah?.n ?? 0;
    this.setNafl(n, curr + delta);
  }

  toggleBool(n: number, key: "d" | "w" | "q") {
    if (this.isFuture(n)) return;
    this.deen.upsertDay(
      n,
      (d) => ({ ...d, salah: { ...d.salah, [key]: !d.salah[key] } } as any)
    );
  }

  setDhikr(day: number, key: keyof Dhikr, v: number) {
    if (this.isFuture(day)) return;
    const clamped = Math.max(0, Math.min(100, Math.floor(v)));
    this.deen.upsertDay(day, (d) => ({
      ...d,
      dhikr: { ...d.dhikr, [key]: clamped },
    }));
  }

  adjustDhikr(day: number, key: keyof Dhikr, delta: number) {
    const curr = this.deen.days()[day]?.dhikr?.[key] ?? 0;
    this.setDhikr(day, key, (curr as number) + delta);
  }

  // Helpers: day→Date, weekday, checks
  dateFor(n: number) {
    const r: any = this.deen.round();
    return new Date(r.year, r.month - 1, n);
  }
  weekday(n: number) {
    return this.dateFor(n).toLocaleDateString(undefined, { weekday: "short" }); // e.g., Mon
  }
  isMonday(n: number) {
    return this.dateFor(n).getDay() === 1;
  } // 0 Sun, 1 Mon, ... 6 Sat
  isThursday(n: number) {
    return this.dateFor(n).getDay() === 4;
  }

  isWhiteDay(n: number) {
    return n === 13 || n === 14 || n === 15;
  }

  fastingLabel(n: number) {
    if (this.isWhiteDay(n)) return "White Days fasting";
    if (this.isMonday(n) || this.isThursday(n)) return "Sunnah fasting";
    return "Optional fasting";
  }

  // Read current toggle for the day
  fastingOn(n: number): boolean {
    const d = this.deen.days()[n]?.siyam;
    if (!d) return false;
    if (this.isWhiteDay(n)) {
      if (n === 13) return !!d.white13;
      if (n === 14) return !!d.white14;
      if (n === 15) return !!d.white15;
    }
    if (this.isMonday(n)) return !!d.mon;
    if (this.isThursday(n)) return !!d.thu;
    return !!d.optional;
  }

  // Toggle it
  toggleFasting(n: number) {
    if (this.isFuture(n)) return;
    this.deen.upsertDay(n, (d) => {
      const next = structuredClone(d);
      if (this.isWhiteDay(n)) {
        if (n === 13) next.siyam.white13 = !next.siyam.white13;
        if (n === 14) next.siyam.white14 = !next.siyam.white14;
        if (n === 15) next.siyam.white15 = !next.siyam.white15;
      } else if (this.isMonday(n)) {
        next.siyam.mon = !next.siyam.mon;
      } else if (this.isThursday(n)) {
        next.siyam.thu = !next.siyam.thu;
      } else {
        next.siyam.optional = !next.siyam.optional;
      }
      return next;
    });
  }

  setQuran(day: number, v: number) {
    if (this.isFuture(day)) return;
    const clamped = Math.max(0, Math.floor(v)); // no upper cap; scoring already caps at 4
    this.deen.upsertDay(day, (d) => ({ ...d, quran: { pages: clamped } }));
  }

  incQuran(day: number, delta: number) {
    const curr = this.deen.days()[day]?.quran?.pages ?? 0;
    this.setQuran(day, curr + delta);
  }

  toggleSadaqah(day: number, key: keyof Sadaqah) {
    if (this.isFuture(day)) return;
    this.deen.upsertDay(day, (d) => ({
      ...d,
      sadaqah: { ...d.sadaqah, [key]: !d.sadaqah[key] },
    }));
  }

  dhikrSum(n: number): number {
    const d = this.deen.days()[n];
    if (!d) return 0;
    const x = d.dhikr;
    return (
      (x?.astaghfirullah ?? 0) +
      (x?.salawat ?? 0) +
      (x?.laIlaha ?? 0) +
      (x?.subhanallah ?? 0) +
      (x?.alhamdulillah ?? 0) +
      (x?.allahuAkbar ?? 0)
    );
  }
  dhikrTargetTotal(): number {
    // 6 items × 100 reps (adjust if you changed your target)
    return 600;
  }
  sadaqahAny(n: number): boolean {
    const s = this.deen.days()[n]?.sadaqah;
    return !!(s?.money || s?.kindness);
  }

  setBool(day: number, path: string[], value: boolean) {
  if (this.isFuture(day)) return;
  this.deen.upsertDay(day, d => {
    const next: any = structuredClone(d);
    let obj = next;
    for (let i = 0; i < path.length - 1; i++) obj = obj[path[i]];
    obj[path[path.length - 1]] = value;
    return next;
  });
}


  exportJSON() {
    this.deen.exportJSON();
  }
  exportCSV() {
    this.deen.exportCSV();
  }
  signOut() {
    this.auth.signOut();
  }
}
