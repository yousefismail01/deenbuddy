// import { Injectable, computed, signal } from "@angular/core";
// import { supabase } from "../core/supabase.client";
// import type { DayRecord, ScoreWeights } from "./scoring.model";
// import { DEFAULT_WEIGHTS } from "./scoring.model";

// // RoundRow now explicitly carries year/month (keep the older cols optional)
// export interface RoundRow {
//   id: string;
//   user_id: string;
//   year: number;
//   month: number;
//   title?: string | null;
//   start_date?: string | null;
//   is_active?: boolean | null;
// }

// type StudentProfile = { id: string; display_name: string | null };
// type MappingRow = { student_id: string; profiles: StudentProfile | StudentProfile[] | null };

// @Injectable({ providedIn: "root" })
// export class DeenService {
//   weights = signal<ScoreWeights>(DEFAULT_WEIGHTS);
//   round = signal<RoundRow | null>(null);
//   days = signal<Record<number, DayRecord>>({});

  

//   /** NEW dayScore: uses d.day for context-aware fasting.
//    *  - Fardh (0–5) emphasized; Witr can be counted as obligation (toggle below).
//    *  - Nafl, Duha, Qiyam in growth.
//    *  - Qurʾān: unlimited points (1/page), with gentle diminishing after target (for balance).
//    *  - Dhikr: 0–100 each, gentle diminishing after targetCount.
//    *  - Fasting: White/Mon-Thu/Optional weights based on the specific day.
//    */
//   private dayScore(d: DayRecord): number {
//     const w = this.weights();
//     const dayNum = d.day;
//     const INCLUDE_WITR_IN_OBLIGATION = true; // set false if you prefer Witr as growth

//     // Obligation
//     const fardhPts = (d.salah.f ?? 0) * w.salah.f; // f is numeric 0..5
//     const witrPts = INCLUDE_WITR_IN_OBLIGATION && d.salah.w ? w.salah.w : 0;
//     const obligation = fardhPts + witrPts;

//     // Growth
//     const naflPts = (d.salah.n ?? 0) * w.salah.n; // n is numeric 0..12
//     const duhaPts = d.salah.d ? w.salah.d : 0;
//     const qiyamPts = d.salah.q ? w.salah.q : 0;

//     // Qurʾān: unlimited points; diminish after daily target (visual target still 4)
//     const pages = d.quran.pages ?? 0;
//     const quranPts = this.diminish(pages, w.quran.dailyTarget, w.quran.perPage);

//     // Dhikr: each item 0..100; diminish after targetCount
//     const dz = (w.dhikr.items as (keyof typeof d.dhikr)[]).reduce((t, key) => {
//       const count = (d.dhikr as any)[key] ?? 0;
//       return t + this.diminish(count, w.dhikr.targetCount, w.dhikr.perItem);
//     }, 0);

//     // Fasting: context-aware weights
//     let fastPts = 0;
//     if (this.isWhiteDay(dayNum)) {
//       if (dayNum === 13 && d.siyam.white13) fastPts += w.siyam.white;
//       if (dayNum === 14 && d.siyam.white14) fastPts += w.siyam.white;
//       if (dayNum === 15 && d.siyam.white15) fastPts += w.siyam.white;
//     } else if (this.isMonday(dayNum) || this.isThursday(dayNum)) {
//       if (this.isMonday(dayNum) && d.siyam.mon) fastPts += w.siyam.monThu;
//       if (this.isThursday(dayNum) && d.siyam.thu) fastPts += w.siyam.monThu;
//     } else {
//       if (d.siyam.optional) fastPts += w.siyam.optional;
//     }

//     // (Optional) Sadaqah points if you’re using them
//     const sadaqahPts =
//       (d.sadaqah?.money ? w.sadaqah.money : 0) +
//       (d.sadaqah?.kindness ? w.sadaqah.kindness : 0);

//     const growth =
//       naflPts + duhaPts + qiyamPts + quranPts + dz + fastPts + sadaqahPts;
//     return obligation + growth;
//   }
//   totalWithoutIshraq = computed(() =>
//     Object.values(this.days()).reduce((t, d) => t + this.dayScore(d), 0)
//   );
//   ishraqTotal = computed(() => {
//     const w = this.weights();
//     let weeks = 0;
//     for (let i = 1; i <= 40; i += 7) {
//       const any = Array.from({ length: 7 }, (_, k) => this.days()[i + k])
//         .filter(Boolean)
//         .some((d) => d.ishraq.done);
//       if (any) weeks++;
//     }
//     return weeks * w.ishraq.perWeek;
//   });

//   // grandTotal = computed(() => this.totalWithoutIshraq() + this.ishraqTotal());

//   // async loadOrCreateRound(userId: string) {
//   //   const { data, error } = await supabase.from('rounds')
//   //     .select('*').eq('user_id', userId).eq('is_active', true).limit(1).maybeSingle();
//   //   if (error) throw error;
//   //   if (!data) {
//   //     const { data: created, error: e2 } = await supabase.from('rounds')
//   //       .insert({ user_id: userId, title: '40-Day Plan' }).select().single();
//   //     if (e2) throw e2;
//   //     this.round.set(created);
//   //     await this.seedDays(created.id);
//   //   } else {
//   //     this.round.set(data);
//   //   }
//   //   await this.loadDays();
//   // }

//   private blankDay(n: number): DayRecord {
//     return {
//       day: n,
//       salah: { f: 0, n: 0, d: false, w: false, q: false },
//       siyam: {
//         mon: false,
//         thu: false,
//         white13: false,
//         white14: false,
//         white15: false,
//         optional: false,
//       },

//       sadaqah: { money: false, kindness: false },
//       quran: { pages: 0 },
//       dhikr: {
//         astaghfirullah: 0,
//         salawat: 0,
//         laIlaha: 0,
//         subhanallah: 0,
//         alhamdulillah: 0,
//         allahuAkbar: 0,
//       },

//       ishraq: { done: false },
//     };
//   }

//   // UPDATE: seed uses daysInMonth and upsert (idempotent)
//   private async seedDays(roundId: string, daysInMonth: number) {
//     const rows = Array.from({ length: daysInMonth }, (_, i) => ({
//       round_id: roundId,
//       day_number: i + 1,
//       data: this.blankDay(i + 1),
//     }));
//     await supabase.from("day_records").upsert(rows, {
//       onConflict: "round_id,day_number",
//       ignoreDuplicates: true,
//     });
//   }

//   async loadDays() {
//     const r = this.round();
//     if (!r) return;
//     const { data, error } = await supabase
//       .from("day_records")
//       .select("day_number, data")
//       .eq("round_id", r.id)
//       .order("day_number");
//     if (error) throw error;
//     const map: Record<number, DayRecord> = {};
//     (data ?? []).forEach((x: any) => (map[x.day_number] = x.data));
//     this.days.set(map);
//   }

//   private clampDay(d: DayRecord): DayRecord {
//   const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Math.floor(x ?? 0)));
//   return {
//     ...d,
//     salah: {
//       f: clamp(d.salah?.f ?? 0, 0, 5),
//       n: clamp(d.salah?.n ?? 0, 0, 12),
//       d: !!d.salah?.d, w: !!d.salah?.w, q: !!d.salah?.q,
//     },
//     quran: { pages: Math.max(0, Math.floor(d.quran?.pages ?? 0)) },
//     dhikr: {
//       astaghfirullah: clamp(d.dhikr?.astaghfirullah ?? 0, 0, 100),
//       salawat:        clamp(d.dhikr?.salawat ?? 0, 0, 100),
//       laIlaha:        clamp(d.dhikr?.laIlaha ?? 0, 0, 100),
//       subhanallah:    clamp(d.dhikr?.subhanallah ?? 0, 0, 100),
//       alhamdulillah:  clamp(d.dhikr?.alhamdulillah ?? 0, 0, 100),
//       allahuAkbar:    clamp(d.dhikr?.allahuAkbar ?? 0, 0, 100),
//     },
//     siyam: {
//       mon: !!d.siyam?.mon, thu: !!d.siyam?.thu,
//       white13: !!d.siyam?.white13, white14: !!d.siyam?.white14, white15: !!d.siyam?.white15,
//       optional: !!d.siyam?.optional,
//     },
//     sadaqah: { money: !!d.sadaqah?.money, kindness: !!d.sadaqah?.kindness },
//     ishraq: { done: !!d.ishraq?.done },
//   };
// }

// async upsertDay(day: number, updater: (d: DayRecord) => DayRecord) {
//   const r = this.round();
//   if (!r) return;

//   const prev = this.days()[day] ?? this.blankDay(day);
//   const next = this.clampDay(updater(structuredClone(prev)));

//   // optimistic UI
//   this.days.update(s => ({ ...s, [day]: next }));

//   const { data, error } = await supabase
//     .from('day_records')
//     .upsert([{ round_id: r.id, day_number: day, data: next }],
//             { onConflict: 'round_id,day_number', ignoreDuplicates: false, defaultToNull: false })
//     .select('day_number, data')
//     .single();

//   if (error) {
//     this.days.update(s => ({ ...s, [day]: prev }));
//     throw error;
//   }
//   if (data?.data) {
//     this.days.update(s => ({ ...s, [day]: data.data as DayRecord }));
//   }
// }


//   exportJSON() {
//     const blob = new Blob(
//       [JSON.stringify({ round: this.round(), days: this.days() }, null, 2)],
//       { type: "application/json" }
//     );
//     this.download(blob, `deen-round-${this.round()?.id ?? "local"}.json`);
//   }

//   exportCSV() {
//     const header = [
//       "day",
//       "f",
//       "n",
//       "d",
//       "w",
//       "q",
//       "mon",
//       "thu",
//       "white13",
//       "white14",
//       "white15",
//       "money",
//       "kindness",
//       "quran_pages",
//       "astagh",
//       "salawat",
//       "laIlaha",
//       "subhan",
//       "alhamd",
//       "akbar",
//       "ishraq",
//       "notes",
//     ];
//     const rows = Object.values(this.days()).map((d) =>
//       [
//         d.day,
//         +d.salah.f,
//         +d.salah.n,
//         +d.salah.d,
//         +d.salah.w,
//         +d.salah.q,
//         +d.siyam.mon,
//         +d.siyam.thu,
//         +d.siyam.white13,
//         +d.siyam.white14,
//         +d.siyam.white15,
//         +d.sadaqah.money,
//         +d.sadaqah.kindness,
//         d.quran.pages,
//         +d.dhikr.astaghfirullah,
//         +d.dhikr.salawat,
//         +d.dhikr.laIlaha,
//         +d.dhikr.subhanallah,
//         +d.dhikr.alhamdulillah,
//         +d.dhikr.allahuAkbar,
//         +d.ishraq.done,
//         (d.notes ?? "").replaceAll(",", ";"),
//       ].join(",")
//     );
//     const csv = [header.join(","), ...rows].join("\n");
//     const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
//     this.download(blob, `deen-round-${this.round()?.id ?? "local"}.csv`);
//   }

//   private download(blob: Blob, filename: string) {
//     const url = URL.createObjectURL(blob);
//     const a = document.createElement("a");
//     a.href = url;
//     a.download = filename;
//     a.click();
//     URL.revokeObjectURL(url);
//   }

// /** Ensure a profiles row exists (defaults to role='user'). */
// async ensureProfile(displayName?: string) {
//   const id = await this.getUid();
//   const { error } = await supabase
//     .from('profiles')
//     .upsert({ id, display_name: displayName ?? null }, { onConflict: 'id' });
//   if (error) throw error;
// }



// private async getUid(): Promise<string> {
//   const { data, error } = await supabase.auth.getUser();
//   if (error || !data.user) throw new Error('Not authenticated');
//   return data.user.id;
// }

// /** List students mapped to me (for instructor/admin views). */
// async listMyStudents(): Promise<StudentProfile[]> {
//   const me = await this.getUid();

//   const { data, error } = await supabase
//     .from('instructors_students')
//     .select('student_id, profiles:student_id ( id, display_name )')
//     .returns<MappingRow[]>(); // <-- give TS the shape

//   if (error) throw error;

//   // Flatten: profiles may be null, object, or array depending on FK metadata
//   return (data ?? []).flatMap((row) => {
//     const p = row.profiles;
//     if (!p) return [];
//     return Array.isArray(p) ? p : [p];
//   });
// }

// /** (Optional) Student enters a code to link to instructor. */
// async linkStudentByCode(code: string) {
//   const student = await this.getUid();
//   const { data: inst, error } = await supabase.from('profiles').select('id').eq('instructor_code', code).single();
//   if (error) throw error;
//   const { error: e2 } = await supabase.from('instructors_students').insert({ instructor_id: inst.id, student_id: student });
//   if (e2) throw e2;
// }



//   // LOAD or CREATE current month period
//   getCurrentMonthCtx() {
//   const now = new Date();
//   return { year: now.getFullYear(), month: now.getMonth() + 1 };
// }
// daysIn(year: number, month: number) { return new Date(year, month, 0).getDate(); }

// private async getOrCreateRound(userId: string, year: number, month: number): Promise<RoundRow> {
//   let { data: r, error } = await supabase
//     .from('rounds')
//     .select('id,user_id,year,month,title,start_date,is_active')
//     .eq('user_id', userId).eq('year', year).eq('month', month)
//     .maybeSingle();
//   if (error) throw error;

//   if (!r) {
//     const { data: created, error: e2 } = await supabase
//       .from('rounds')
//       .insert({
//         user_id: userId, year, month,
//         title: 'Monthly Plan',
//         start_date: `${year}-${String(month).padStart(2,'0')}-01`,
//         is_active: true
//       })
//       .select('id,user_id,year,month,title,start_date,is_active')
//       .single();
//     if (e2) throw e2;
//     r = created!;
//   }
//   return r!;
// }

// /** Normal user dashboard: load MY month (creates if missing). */
// async loadOrCreateCurrentMonth() {
//   const uid = await this.getUid();
//   const { year, month } = this.getCurrentMonthCtx();

//   // get or create round
//   let { data: r, error } = await supabase
//     .from('rounds')
//     .select('id,user_id,year,month,title,start_date,is_active')
//     .eq('user_id', uid).eq('year', year).eq('month', month)
//     .maybeSingle();
//   if (error) { console.error('select rounds error', error); throw error; }

//   if (!r) {
//     const ins = await supabase
//       .from('rounds')
//       .insert({
//         user_id: uid,
//         year, month,
//         title: 'Monthly Plan',
//         start_date: `${year}-${String(month).padStart(2,'0')}-01`,
//         is_active: true
//       })
//       .select('id,user_id,year,month,title,start_date,is_active')
//       .single();
//     if (ins.error) { console.error('insert round error', ins.error); throw ins.error; }
//     r = ins.data!;
//   }

//   this.round.set(r);

//   // seed day_records (idempotent)
//   const toSeed = this.daysIn(year, month);
//   const seedRes = await supabase.from('day_records').upsert(
//     Array.from({ length: toSeed }, (_, i) => ({
//       round_id: r.id,
//       day_number: i + 1,
//       data: this.blankDay(i + 1),
//     })),
//     { onConflict: 'round_id,day_number', ignoreDuplicates: true }
//   );
//   if (seedRes.error) { console.error('seed error', seedRes.error); throw seedRes.error; }

//   // load days
//   const rows = await supabase
//     .from('day_records')
//     .select('day_number, data')
//     .eq('round_id', r.id)
//     .order('day_number');
//   if (rows.error) { console.error('load days error', rows.error); throw rows.error; }

//   const map: Record<number, DayRecord> = {};
//   (rows.data ?? []).forEach((x: any) => (map[x.day_number] = x.data));
//   this.days.set(map);
// }

// /** Instructor/Admin view: load SOMEONE ELSE'S month (respecting RLS). */
// async loadUserMonth(userId: string, year: number, month: number) {
//   const r = await this.getOrCreateRound(userId, year, month);
//   this.round.set(r);

//   // No seeding for others unless you want to; but it's safe & idempotent:
//   await this.seedDays(r.id, this.daysIn(year, month));

//   const { data } = await supabase
//     .from('day_records')
//     .select('day_number, data')
//     .eq('round_id', r.id)
//     .order('day_number');
//   const map: Record<number, DayRecord> = {};
//   (data ?? []).forEach((x: any) => (map[x.day_number] = x.data));
//   this.days.set(map);
// }

// /** For charts/history pickers. */
// async listMonths(userId: string) {
//   const { data, error } = await supabase
//     .from('rounds')
//     .select('year,month')
//     .eq('user_id', userId)
//     .order('year', { ascending: true })
//     .order('month', { ascending: true });
//   if (error) throw error;
//   return data ?? [];
// }
//   // ===== Helpers: dates for monthly context =====
//   dateFor(day: number) {
//     const r: any = this.round();
//     return new Date(r.year, r.month - 1, day);
//   }
//   isMonday(day: number) {
//     return this.dateFor(day).getDay() === 1;
//   }
//   isThursday(day: number) {
//     return this.dateFor(day).getDay() === 4;
//   }
//   isWhiteDay(day: number) {
//     return day === 13 || day === 14 || day === 15;
//   }

//   // ===== Soft-diminishing utility (no hard caps; gentler past target) =====
//   private diminish(x: number, target: number, perPoint: number) {
//     if (x <= target) return x * perPoint;
//     const extra = x - target;
//     return target * perPoint + Math.sqrt(extra) * perPoint;
//   }

//   // ===== Daily score breakdown (obligation, growth, gauge, targets) =====
//   dayBreakdown(dayNum: number) {
//     const d = this.days()[dayNum];
//     const w = this.weights();
//     if (!d)
//       return {
//         obligation: 0,
//         growth: 0,
//         total: 0,
//         gauge: 0,
//         targetObligation: 0,
//         targetGrowth: 0,
//         targetTotal: 0,
//       };

//     // 1) Obligation (Fardh + optionally Witr)
//     const INCLUDE_WITR_IN_OBLIGATION = true; // flip to false if you prefer Witr as growth
//     const fardhPts = (d.salah.f ?? 0) * w.salah.f; // f is 0..5
//     const witrPts = INCLUDE_WITR_IN_OBLIGATION && d.salah.w ? w.salah.w : 0;
//     const obligation = fardhPts + witrPts;

//     // 2) Growth (Nafl, Duha, Qiyam, Qur'an, Dhikr, Fasting, Sadaqah/Ishrāq if used)
//     const naflPts = (d.salah.n ?? 0) * w.salah.n; // 0..12
//     const duhaPts = d.salah.d ? w.salah.d : 0;
//     const qiyamPts = d.salah.q ? w.salah.q : 0;

//     // Qur'ān: unlimited, gentle diminishing after daily target
//     const qPages = d.quran.pages ?? 0;
//     const quranPts = this.diminish(
//       qPages,
//       w.quran.dailyTarget,
//       w.quran.perPage
//     );

//     // Dhikr: each item 0..100, use diminish after targetCount
//     const dz = (w.dhikr.items as (keyof typeof d.dhikr)[]).reduce((t, k) => {
//       const cnt = (d.dhikr as any)[k] ?? 0;
//       return t + this.diminish(cnt, w.dhikr.targetCount, w.dhikr.perItem);
//     }, 0);

//     // Fasting (context-aware)
//     let fastPts = 0;
//     if (this.isWhiteDay(dayNum)) {
//       if (dayNum === 13 && d.siyam.white13) fastPts += w.siyam.white;
//       if (dayNum === 14 && d.siyam.white14) fastPts += w.siyam.white;
//       if (dayNum === 15 && d.siyam.white15) fastPts += w.siyam.white;
//     } else if (this.isMonday(dayNum) || this.isThursday(dayNum)) {
//       if (this.isMonday(dayNum) && d.siyam.mon) fastPts += w.siyam.monThu;
//       if (this.isThursday(dayNum) && d.siyam.thu) fastPts += w.siyam.monThu;
//     } else {
//       if (d.siyam.optional) fastPts += w.siyam.optional;
//     }

//     // Optional: Sadaqah
//     const sadaqahPts =
//       (d.sadaqah?.money ? w.sadaqah.money : 0) +
//       (d.sadaqah?.kindness ? w.sadaqah.kindness : 0);

//     // Growth total
//     const growth =
//       naflPts + duhaPts + qiyamPts + quranPts + dz + fastPts + sadaqahPts;

//     // ---- 3) TARGETS for gauge (unchanged) ----
//     const targetObligation =
//       5 * w.salah.f + (INCLUDE_WITR_IN_OBLIGATION ? w.salah.w : 0);

//     const targetGrowth =
//       12 * w.salah.n + // Nafl 12
//       w.salah.d + // Duha done
//       w.salah.q + // Qiyam done
//       w.quran.dailyTarget * w.quran.perPage + // Qur'an 4 pages (display target)
//       w.dhikr.items.length * w.dhikr.targetCount * w.dhikr.perItem + // Dhikr 100 each
//       // Fasting: day-type target (max one toggle per day)
//       (this.isWhiteDay(dayNum)
//         ? w.siyam.white
//         : this.isMonday(dayNum) || this.isThursday(dayNum)
//         ? w.siyam.monThu
//         : w.siyam.optional) +
//       // Sadaqah: treat both toggles as the "target"
//       (w.sadaqah.money + w.sadaqah.kindness);

//     const targetTotal = targetObligation + targetGrowth;

//     // ---- 4) GAUGE via per-category capped contributions ----
//     const metObligation =
//       Math.min(fardhPts, 5 * w.salah.f) +
//       (INCLUDE_WITR_IN_OBLIGATION ? Math.min(witrPts, w.salah.w) : 0);

//     // Growth components capped at their target
//     const metNafl = Math.min(naflPts, 12 * w.salah.n);
//     const metDuha = Math.min(duhaPts, w.salah.d);
//     const metQiyam = Math.min(qiyamPts, w.salah.q);
//     const metQuran = Math.min(
//       (d.quran.pages ?? 0) * w.quran.perPage,
//       w.quran.dailyTarget * w.quran.perPage
//     );
//     const metDhikr = (w.dhikr.items as (keyof typeof d.dhikr)[]).reduce(
//       (t, k) => {
//         const cnt = (d.dhikr as any)[k] ?? 0;
//         return (
//           t +
//           Math.min(cnt * w.dhikr.perItem, w.dhikr.targetCount * w.dhikr.perItem)
//         );
//       },
//       0
//     );
//     const metFasting = this.isWhiteDay(dayNum)
//       ? (d.siyam.white13 && dayNum === 13) ||
//         (d.siyam.white14 && dayNum === 14) ||
//         (d.siyam.white15 && dayNum === 15)
//         ? w.siyam.white
//         : 0
//       : this.isMonday(dayNum)
//       ? d.siyam.mon
//         ? w.siyam.monThu
//         : 0
//       : this.isThursday(dayNum)
//       ? d.siyam.thu
//         ? w.siyam.monThu
//         : 0
//       : d.siyam.optional
//       ? w.siyam.optional
//       : 0;
//     const metSadaqah =
//       (d.sadaqah?.money ? w.sadaqah.money : 0) +
//       (d.sadaqah?.kindness ? w.sadaqah.kindness : 0);

//     const metGrowth =
//       metNafl +
//       metDuha +
//       metQiyam +
//       metQuran +
//       metDhikr +
//       metFasting +
//       metSadaqah;

//     // Final numbers
//     const total = obligation + growth;

//     // exact 100 when targets met; epsilon avoids 99 due to FP noise
//     const eps = 1e-9;
//     const gauge = Math.max(
//       0,
//       Math.min(
//         150,
//         Math.round(
//           ((metObligation + metGrowth) / Math.max(targetTotal, eps) + eps) * 100
//         )
//       )
//     );

//     // return everything you were returning before:
//     return {
//       obligation,
//       growth,
//       total,
//       gauge,
//       targetObligation,
//       targetGrowth,
//       targetTotal,
//     };
//   }

//   // ===== Monthly aggregates =====
//   obligationTotal = computed(() =>
//     Object.keys(this.days()).reduce(
//       (t, k) => t + this.dayBreakdown(+k).obligation,
//       0
//     )
//   );
//   growthTotal = computed(() =>
//     Object.keys(this.days()).reduce(
//       (t, k) => t + this.dayBreakdown(+k).growth,
//       0
//     )
//   );
//   grandTotal = computed(() => this.obligationTotal() + this.growthTotal());

//   // ===== Weekly bonuses =====
//   // +10 if ≥5 days in the week with gauge ≥60
//   // +10 if all 7 days in the week had fardh count = 5
//   weeklyBonus = computed(() => {
//     const r: any = this.round();
//     if (!r) return 0;
//     // Build weeks as Sun..Sat (or switch to Mon..Sun if you prefer)
//     const daysInMonth = new Date(r.year, r.month, 0).getDate();
//     const byWeek: Record<string, number[]> = {}; // key = ISO week start date string
//     for (let day = 1; day <= daysInMonth; day++) {
//       const dt = this.dateFor(day);
//       const start = new Date(dt);
//       start.setDate(dt.getDate() - dt.getDay()); // Sunday start
//       const key = `${start.getFullYear()}-${
//         start.getMonth() + 1
//       }-${start.getDate()}`;
//       (byWeek[key] ??= []).push(day);
//     }
//     let bonus = 0;
//     for (const key of Object.keys(byWeek)) {
//       const days = byWeek[key];
//       const gauges = days.map((d) => this.dayBreakdown(d).gauge);
//       const passGauge = gauges.filter((g) => g >= 60).length >= 5 ? 10 : 0;
//       const fardhAll7 =
//         days.length === 7 &&
//         days.every((d) => (this.days()[d]?.salah?.f ?? 0) === 5)
//           ? 10
//           : 0;
//       bonus += passGauge + fardhAll7;
//     }
//     return bonus;
//   });

//   // Final total including bonuses
//   grandTotalWithBonuses = computed(
//     () => this.grandTotal() + this.weeklyBonus()
//   );
// }
