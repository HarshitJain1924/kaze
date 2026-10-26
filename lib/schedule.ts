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
  queryAiringAtGreater: number; // Padded Unix seconds (accounts for UTC-12 to UTC+14 timezone offset)
  queryAiringAtLesser: number; // Padded Unix seconds (accounts for UTC-12 to UTC+14 timezone offset)
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

export function toIsoDateString(d: Date, timeZone?: string): string {
  if (timeZone) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).formatToParts(d);
      const year = parts.find((p) => p.type === "year")?.value;
      const month = parts.find((p) => p.type === "month")?.value;
      const day = parts.find((p) => p.type === "day")?.value;
      if (year && month && day) {
        return `${year}-${month}-${day}`;
      }
    } catch {
      // Fall back to local getters if timezone is unrecognized
    }
  }
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Parses a Date, ISO date string "YYYY-MM-DD", or timestamp into a local noon Date object.
 * Using midday (12:00:00) avoids date shifting across timezones or DST transitions.
 */
export function parseDateInput(input?: Date | string | null): Date {
  if (!input) return new Date();
  if (input instanceof Date) return new Date(input.getTime());
  if (typeof input === "string") {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input.trim());
    if (match) {
      const year = Number(match[1]);
      const month = Number(match[2]) - 1;
      const day = Number(match[3]);
      return new Date(year, month, day, 12, 0, 0);
    }
    const parsed = new Date(input);
    if (!isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  return new Date();
}

/**
 * Returns Monday-Sunday boundaries and 7 daily metadata entries for any reference date.
 */
export function getWeekRange(
  referenceDate: Date | string = new Date(),
  timeZone?: string,
): WeekRange {
  const d = parseDateInput(referenceDate);
  const dayOfWeek = d.getDay();
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;

  const monday = new Date(
    d.getFullYear(),
    d.getMonth(),
    d.getDate() + diffToMonday,
    0,
    0,
    0,
    0,
  );

  const sunday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 6,
    23,
    59,
    59,
    999,
  );

  const todayStr = toIsoDateString(new Date(), timeZone);

  const days: WeekRange["days"] = [];
  for (let i = 0; i < 7; i += 1) {
    const cur = new Date(
      monday.getFullYear(),
      monday.getMonth(),
      monday.getDate() + i,
      12,
      0,
      0,
    );
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

  const prevMonday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() - 7,
    12,
    0,
    0,
  );

  const nextMonday = new Date(
    monday.getFullYear(),
    monday.getMonth(),
    monday.getDate() + 7,
    12,
    0,
    0,
  );

  const monthFormatter = new Intl.DateTimeFormat("en-US", { month: "short" });
  const startMonth = monthFormatter.format(monday);
  const endMonth = monthFormatter.format(sunday);
  const weekLabel =
    startMonth === endMonth
      ? `${startMonth} ${monday.getDate()} – ${sunday.getDate()}, ${sunday.getFullYear()}`
      : `${startMonth} ${monday.getDate()} – ${endMonth} ${sunday.getDate()}, ${sunday.getFullYear()}`;

  const mondaySec = Math.floor(monday.getTime() / 1000);
  const sundaySec = Math.floor(sunday.getTime() / 1000);
  // Pad query range by 28 hours (100,800 sec) to cover timezone offsets up to UTC+14 / UTC-12
  const paddingSec = 28 * 3600;

  return {
    monday,
    sunday,
    airingAtGreater: mondaySec - 1,
    airingAtLesser: sundaySec + 1,
    queryAiringAtGreater: mondaySec - paddingSec,
    queryAiringAtLesser: sundaySec + paddingSec,
    days,
    prevWeekDate: toIsoDateString(prevMonday),
    nextWeekDate: toIsoDateString(nextMonday),
    weekLabel,
  };
}

/**
 * Groups an array of airing schedule entries by date "YYYY-MM-DD".
 * Filters out entries from the query-padding window that fall outside the 7 days of the week.
 */
export function groupScheduleByDay(
  entries: AiringScheduleEntry[],
  weekDays: WeekRange["days"],
  timeZone?: string,
): WeeklyScheduleDay[] {
  const map = new Map<string, AiringScheduleEntry[]>();
  for (const day of weekDays) {
    map.set(day.date, []);
  }

  for (const entry of entries) {
    const entryDate = new Date(entry.airingAt * 1000);
    const dateStr = toIsoDateString(entryDate, timeZone);
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

export interface TimeZoneOption {
  value: string;
  label: string;
  region: string;
}

export const COMMON_TIMEZONES: TimeZoneOption[] = [
  { value: "auto", label: "Device Local (Auto-detect)", region: "Automatic" },
  { value: "Asia/Tokyo", label: "Japan Standard Time (JST) · Original broadcast", region: "Asia & Pacific" },
  { value: "Asia/Kolkata", label: "India Standard Time (IST)", region: "Asia & Pacific" },
  { value: "Asia/Singapore", label: "Singapore / Malaysia (SGT)", region: "Asia & Pacific" },
  { value: "Asia/Seoul", label: "Korea Standard Time (KST)", region: "Asia & Pacific" },
  { value: "Asia/Shanghai", label: "China Standard Time (CST)", region: "Asia & Pacific" },
  { value: "Asia/Bangkok", label: "Indochina Time (ICT)", region: "Asia & Pacific" },
  { value: "Asia/Dubai", label: "Gulf Standard Time (GST)", region: "Asia & Pacific" },
  { value: "Australia/Sydney", label: "Australian Eastern Time (AEST/AEDT)", region: "Asia & Pacific" },
  { value: "America/New_York", label: "Eastern Time (ET - New York, Toronto)", region: "Americas" },
  { value: "America/Chicago", label: "Central Time (CT - Chicago, Dallas)", region: "Americas" },
  { value: "America/Denver", label: "Mountain Time (MT - Denver)", region: "Americas" },
  { value: "America/Los_Angeles", label: "Pacific Time (PT - Los Angeles, SF)", region: "Americas" },
  { value: "America/Sao_Paulo", label: "Brasília Time (BRT - São Paulo)", region: "Americas" },
  { value: "Europe/London", label: "UK / Ireland (GMT / BST - London)", region: "Europe" },
  { value: "Europe/Paris", label: "Central European Time (CET / CEST - Paris, Berlin)", region: "Europe" },
  { value: "Europe/Athens", label: "Eastern European Time (EET - Athens)", region: "Europe" },
  { value: "UTC", label: "Coordinated Universal Time (UTC)", region: "Universal" },
];

/**
 * Resolves short timezone abbreviation (e.g. "IST", "JST", "EDT", "UTC").
 */
export function getTimeZoneAbbr(
  airingAtOrDate?: number | Date,
  timeZone?: string,
): string {
  try {
    const d =
      typeof airingAtOrDate === "number"
        ? new Date(airingAtOrDate * 1000)
        : airingAtOrDate instanceof Date
          ? airingAtOrDate
          : new Date();
    const options: Intl.DateTimeFormatOptions = {
      timeZoneName: "short",
    };
    if (timeZone && timeZone !== "auto") {
      options.timeZone = timeZone;
    }
    const parts = new Intl.DateTimeFormat("en-US", options).formatToParts(d);
    return parts.find((p) => p.type === "timeZoneName")?.value ?? (timeZone || "UTC");
  } catch {
    return timeZone || "UTC";
  }
}

/**
 * Returns a human-friendly label for a timezone, e.g. "Asia/Kolkata (IST)".
 */
export function getTimeZoneDisplayName(
  timeZone?: string,
  deviceTz?: string,
): string {
  if (!timeZone || timeZone === "auto") {
    const resolved =
      deviceTz ||
      (typeof window !== "undefined"
        ? Intl.DateTimeFormat().resolvedOptions().timeZone
        : "UTC");
    const abbr = getTimeZoneAbbr(undefined, resolved);
    return abbr && abbr !== resolved ? `${resolved} (${abbr})` : resolved;
  }
  const abbr = getTimeZoneAbbr(undefined, timeZone);
  return abbr && abbr !== timeZone ? `${timeZone} (${abbr})` : timeZone;
}

/**
 * Formats a Unix timestamp into a user-friendly local time string (e.g. "8:30 PM").
 */
export function formatAiringTime(
  airingAt: number,
  timeZone?: string,
  options?: { includeZone?: boolean },
): string {
  const date = new Date(airingAt * 1000);
  const formatOptions: Intl.DateTimeFormatOptions = {
    hour: "numeric",
    minute: "2-digit",
  };
  if (timeZone && timeZone !== "auto") {
    formatOptions.timeZone = timeZone;
  }
  if (options?.includeZone) {
    formatOptions.timeZoneName = "short";
  }
  return new Intl.DateTimeFormat("en-US", formatOptions).format(date);
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
