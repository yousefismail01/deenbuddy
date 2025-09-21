import { Injectable } from "@angular/core";
import { supabase } from "../../core/supabase.client";
import type {
  DayRecord,
  MappingRow,
  RoundRow,
  StudentProfile,
} from "../domain/deen-types";

@Injectable({ providedIn: "root" })
export class DeenRepo {
  // ---------- Auth ----------
  async getUid(): Promise<string> {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw new Error("Not authenticated");
    return data.user.id;
  }

  // ---------- Profiles ----------
  async ensureProfile(displayName?: string) {
    const id = await this.getUid();
    const { error } = await supabase
      .from("profiles")
      .upsert({ id, display_name: displayName ?? null }, { onConflict: "id" });
    if (error) throw error;
  }

  async listMyStudents(): Promise<StudentProfile[]> {
    const { data, error } = await supabase
      .from("instructors_students")
      .select("student_id, profiles:student_id ( id, display_name )")
      .returns<MappingRow[]>();
    if (error) throw error;
    return (data ?? []).flatMap((row) => {
      const p = row.profiles;
      if (!p) return [];
      return Array.isArray(p) ? p : [p];
    });
  }

  async linkStudentByCode(code: string) {
    const student = await this.getUid();
    const { data: inst, error } = await supabase
      .from("profiles")
      .select("id")
      .eq("instructor_code", code)
      .single();
    if (error) throw error;
    const { error: e2 } = await supabase
      .from("instructors_students")
      .insert({ instructor_id: (inst as any).id, student_id: student });
    if (e2) throw e2;
  }

  // ---------- Rounds ----------
  async getOrCreateRound(
    userId: string,
    year: number,
    month: number
  ): Promise<RoundRow> {
    let { data: r, error } = await supabase
      .from("rounds")
      .select("id,user_id,year,month,title,start_date,is_active")
      .eq("user_id", userId)
      .eq("year", year)
      .eq("month", month)
      .maybeSingle();
    if (error) throw error;

    if (!r) {
      const ins = await supabase
        .from("rounds")
        .insert({
          user_id: userId,
          year,
          month,
          title: "Monthly Plan",
          start_date: `${year}-${String(month).padStart(2, "0")}-01`,
          is_active: true,
        })
        .select("id,user_id,year,month,title,start_date,is_active")
        .single();
      if (ins.error) throw ins.error;
      r = ins.data!;
    }
    return r!;
  }

  async loadDayRecords(roundId: string) {
    const { data, error } = await supabase
      .from("day_records")
      .select("day_number, data")
      .eq("round_id", roundId)
      .order("day_number");
    if (error) throw error;
    return data ?? [];
  }

  async upsertDay(roundId: string, day: number, data: DayRecord) {
    const { data: ret, error } = await supabase
      .from("day_records")
      .upsert([{ round_id: roundId, day_number: day, data }], {
        onConflict: "round_id,day_number",
        ignoreDuplicates: false,
        defaultToNull: false,
      })
      .select("day_number, data")
      .single();
    if (error) throw error;
    return ret;
  }

  async seedDays(
    roundId: string,
    daysInMonth: number,
    blankDay: (n: number) => DayRecord
  ) {
    const rows = Array.from({ length: daysInMonth }, (_, i) => ({
      round_id: roundId,
      day_number: i + 1,
      data: blankDay(i + 1),
    }));
    const { error } = await supabase.from("day_records").upsert(rows, {
      onConflict: "round_id,day_number",
      ignoreDuplicates: true,
    });
    if (error) throw error;
  }

  async listMonths(userId: string) {
    const { data, error } = await supabase
      .from("rounds")
      .select("year,month")
      .eq("user_id", userId)
      .order("year", { ascending: true })
      .order("month", { ascending: true });
    if (error) throw error;
    return data ?? [];
  }
}
