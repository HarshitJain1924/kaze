import type { AiringScheduleEntry, WeeklyScheduleDay } from "@/types/anime";

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const DAY_SHORTS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

export interface WeekRange {
  monday: Date;
  sunday: Date;
  airingAtGreater: number; // Unix seconds
  airingAtLesser: number; // Unix seconds
  days: Array<{
    date: string; // "YYYY-MM-DD"
    dayName: string;
    dayShort: string;
    dayNumber: number;
    isToday: boolean;
  }>;
  prevWeekDate: string; // "YYYY-MM-DD"
  nextWeekDate: string; // "YYYY-MM-DD"
  weekLabel: string; // e.g. "Oct 19 – Oct 25, 2026"
}

export function toIsoDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Returns Monday-Sunday boundaries and 7 daily metadata entries for any reference date.
 */
export function getWeekRange(referenceDate: Date = new Date()): WeekRange {
  const d = new Date(referenceDate);
  const dayOfWeek = d.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const todayStr = toIsoDateString(new Date());

  const days: WeekRange["days"] = [];
  for (let i = 0; i < 7; i += 1) {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const dateStr = toIsoDateString(cur);
    const curDay = cur.getDay();

    days.push({
      date: dateStr,
      dayName: DAY_NAMES[curDay] ?? "Monday",
      dayShort: DAY_SHORTS[curDay] ?? "Mon",
      dayNumber: cur.getDate(),
      isToday: dateStr === todayStr,
    });
  }

  const prevMonday = new Date(monday);
  prevMonday.setDate(monday.getDate() - 7);

  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);

  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
  const startMonth = monthFormatter.format(monday);
  const endMonth = monthFormatter.format(sunday);
  const weekLabel =
    startMonth === endMonth
      ? `${startMonth} ${monday.getDate()} – ${sunday.getDate()}, ${sunday.getFullYear()}`
      : `${startMonth} ${monday.getDate()} – ${endMonth} ${sunday.getDate()}, ${sunday.getFullYear()}`;

  return {
    monday,
    sunday,
    airingAtGreater: Math.floor(monday.getTime() / 1000) - 1,
    airingAtLesser: Math.floor(sunday.getTime() / 1000) + 1,
    days,
    prevWeekDate: toIsoDateString(prevMonday),
    nextWeekDate: toIsoDateString(nextMonday),
    weekLabel,
  };
}

/**
 * Groups an array of airing schedule entries by local date "YYYY-MM-DD".
 */
export function groupScheduleByDay(
  entries: AiringScheduleEntry[],
  weekDays: WeekRange["days"],
): WeeklyScheduleDay[] {
  const map = new Map<string, AiringScheduleEntry[]>();
  for (const day of weekDays) {
    map.set(day.date, []);
  }

  for (const entry of entries) {
    const entryDate = new Date(entry.airingAt * 1000);
    const dateStr = toIsoDateString(entryDate);
    const list = map.get(dateStr);
    if (list) {
      list.push(entry);
    }
  }

  // Sort entries within each day by airingAt ascending
  return weekDays.map((day) => {
    const dayEntries = map.get(day.date) ?? [];
    dayEntries.sort((a, b) => a.airingAt - b.airingAt);
    return {
      ...day,
      entries: dayEntries,
    };
  });
}

/**
 * Formats a Unix timestamp into a user-friendly local time string (e.g. "8:30 PM").
 */
export function formatAiringTime(airingAt: number): string {
  const date = new Date(airingAt * 1000);
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

/**
 * Returns a human-friendly relative status (e.g. "Airs in 2h", "Aired 1h ago").
 */
export function formatAiringRelative(
  airingAt: number,
  nowMs: number = Date.now(),
): { label: string; hasAired: boolean } {
  const targetMs = airingAt * 1000;
  const diffSec = Math.round((targetMs - nowMs) / 1000);

  if (diffSec <= 0) {
    const pastSec = Math.abs(diffSec);
    if (pastSec < 3600) {
      const mins = Math.max(1, Math.round(pastSec / 60));
      return { label: `Aired ${mins}m ago`, hasAired: true };
    }
    if (pastSec < 86400) {
      const hours = Math.round(pastSec / 3600);
      return { label: `Aired ${hours}h ago`, hasAired: true };
    }
    const days = Math.round(pastSec / 86400);
    return { label: `Aired ${days}d ago`, hasAired: true };
  }

  if (diffSec < 3600) {
    const mins = Math.max(1, Math.round(diffSec / 60));
    return { label: `In ${mins}m`, hasAired: false };
  }
  if (diffSec < 86400) {
    const hours = Math.round(diffSec / 3600);
    return { label: `In ${hours}h`, hasAired: false };
  }
  const days = Math.round(diffSec / 86400);
  return { label: `In ${days}d`, hasAired: false };
}
