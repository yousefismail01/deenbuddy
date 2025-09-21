// Pure types shared everywhere

export interface DayRecord {
  day: number;
  salah: { f: number; n: number; d: boolean; w: boolean; q: boolean };
  siyam: {
    mon: boolean;
    thu: boolean;
    white13: boolean;
    white14: boolean;
    white15: boolean;
    optional: boolean;
  };
  sadaqah: { money: boolean; kindness: boolean };
  quran: { pages: number };
  dhikr: {
    astaghfirullah: number;
    salawat: number;
    laIlaha: number;
    subhanallah: number;
    alhamdulillah: number;
    allahuAkbar: number;
  };
  ishraq: { done: boolean };
  notes?: string;
}

export interface ScoreWeights {
  salah: { f: number; n: number; d: number; w: number; q: number };
  quran: { perPage: number; dailyTarget: number };
  dhikr: {
    perItem: number;
    targetCount: number;
    items: (keyof DayRecord["dhikr"])[];
  };
  siyam: { white: number; monThu: number; optional: number };
  sadaqah: { money: number; kindness: number };
  ishraq: { perWeek: number };
}

export const DEFAULT_WEIGHTS: ScoreWeights = {
  salah: { f: 3, n: 0.5, d: 1, w: 1, q: 2 },
  quran: { perPage: 1, dailyTarget: 4 },
  dhikr: {
    perItem: 0.05,
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
  siyam: { white: 5, monThu: 3, optional: 1 },
  sadaqah: { money: 2, kindness: 1 },
  ishraq: { perWeek: 5 },
};

export interface RoundRow {
  id: string;
  user_id: string;
  year: number;
  month: number;
  title?: string | null;
  start_date?: string | null;
  is_active?: boolean | null;
}

export type StudentProfile = { id: string; display_name: string | null };
export type MappingRow = {
  student_id: string;
  profiles: StudentProfile | StudentProfile[] | null;
};
