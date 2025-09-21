export type YesNo = boolean;
export interface Salah {
  f: number; // 0..5 (Fardh on time count)
  n: number; // 0..12 (Nafl/optional count)
  d: boolean; // Duha (0 or 2 points)
  w: boolean; // Witr (0 or 1 point)
  q: boolean; // Qiyam (0 or 2 points)
}
export interface Siyam {
  mon: boolean;
  thu: boolean;
  white13: boolean;
  white14: boolean;
  white15: boolean;
  optional?: boolean; // NEW: for non-Mon/Thu, non-White days
}
export interface Sadaqah {
  money: YesNo;
  kindness: YesNo;
}
export interface Quran {
  pages: number;
}
export interface Dhikr {
  astaghfirullah: number; // 0..100
  salawat: number; // 0..100
  laIlaha: number; // 0..100
  subhanallah: number; // 0..100
  alhamdulillah: number; // 0..100
  allahuAkbar: number; // 0..100
}

export interface Ishraq {
  done: YesNo;
}
export interface DayRecord {
  day: number;
  date?: string;
  notes?: string;
  salah: Salah;
  siyam: Siyam;
  sadaqah: Sadaqah;
  quran: Quran;
  dhikr: Dhikr;
  ishraq: Ishraq;
}
export interface ScoreWeights {
  // Salah
  salah: { f: number; n: number; d: number; w: number; q: number };
  // Fasting (context-aware)
  siyam: { white: number; monThu: number; optional: number };
  // Sadaqah (unchanged, if you still use it)
  sadaqah: { money: number; kindness: number };
  // Qurʾān
  quran: { perPage: number; dailyTarget: number }; // target only for gauge/hints
  // Dhikr
  dhikr: { perItem: number; targetCount: number; items: string[] };
  // Ishraq (if you still use it weekly; or remove)
  ishraq: { perWeek: number };
}
export const DEFAULT_WEIGHTS: ScoreWeights = {
  salah: { f: 2, n: 0.5, d: 2, w: 1, q: 2 }, // Fardh emphasized; N is lighter
  siyam: { white: 3, monThu: 2, optional: 1 }, // contextual fasting weights
  sadaqah: { money: 1, kindness: 1 }, // keep or adjust as you like
  quran: { perPage: 1, dailyTarget: 4 }, // 1 point/page; no max cap in scoring
  dhikr: {
    perItem: 0.1,
    targetCount: 100,
    items: [
      "astaghfirullah",
      "salawat",
      "laIlaha",
      "subhanallah",
      "alhamdulillah",
      "allahuAkbar",
    ],
  },
  ishraq: { perWeek: 6 },
};
