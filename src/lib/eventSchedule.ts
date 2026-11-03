import type { EventCategory, RightPanelSlide } from "./api";

export type RightPanelSlideLike = RightPanelSlide;

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export interface ParsedSchedule {
  category: EventCategory;
  start_date: string | null;
  end_date: string | null;
  start_time: string | null;
  end_time: string | null;
}

function readDateField(
  raw: unknown,
  field: string
): string | null | { error: string } {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string" || !DATE_PATTERN.test(raw)) {
    return { error: `${field} must be a valid YYYY-MM-DD date` };
  }
  const [year, month, day] = raw.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return { error: `${field} must be a valid YYYY-MM-DD date` };
  }
  return raw;
}

function readTimeField(
  raw: unknown,
  field: string
): string | null | { error: string } {
  if (raw === undefined || raw === null || raw === "") return null;
  if (typeof raw !== "string" || !TIME_PATTERN.test(raw)) {
    return { error: `${field} must be a valid HH:MM time` };
  }
  return raw;
}

/** Validate category/date/time coming from the admin UI or an API request. */
export function parseScheduleInput(
  raw: Record<string, unknown>
): ParsedSchedule | { error: string } {
  const category = normalizeCategory(raw.category);
  const startDate = readDateField(raw.start_date, "start_date");
  if (startDate && typeof startDate === "object") return startDate;
  const endDate = readDateField(raw.end_date, "end_date");
  if (endDate && typeof endDate === "object") return endDate;
  const startTime = readTimeField(raw.start_time, "start_time");
  if (startTime && typeof startTime === "object") return startTime;
  const endTime = readTimeField(raw.end_time, "end_time");
  if (endTime && typeof endTime === "object") return endTime;

  if (startDate && endDate && endDate < startDate) {
    return { error: "end_date cannot be before start_date" };
  }

  return {
    category,
    start_date: startDate,
    end_date: endDate,
    start_time: startTime,
    end_time: endTime,
  };
}

export function normalizeCategory(value: unknown): EventCategory {
  if (value === "Conference" || value === "Hackathons" || value === "Events") {
    return value;
  }
  return "Events";
}

/** A local (not UTC) YYYY-MM-DD key, so the kiosk flips dates at local midnight. */
export function localDateKey(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function validDateKey(value: unknown): string | null {
  if (typeof value !== "string" || !DATE_PATTERN.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(year, month - 1, day);
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null;
  }
  return value;
}

function categoryOf(slide: RightPanelSlideLike): EventCategory {
  return normalizeCategory(slide.category);
}

function hasStartDate(slide: RightPanelSlideLike): boolean {
  return validDateKey(slide.start_date) !== null;
}

/** Whether a right-panel slide is allowed to appear on the given day. */
export function slideIsVisibleOn(slide: RightPanelSlideLike, todayKey: string): boolean {
  const category = categoryOf(slide);
  const start = validDateKey(slide.start_date);
  const end = validDateKey(slide.end_date) ?? start;

  if (category === "Events") {
    // Existing slides have no date; keep showing them.
    if (!start) return true;
    return todayKey >= start && todayKey <= end!;
  }

  // Conference and Hackathons are evergreen fallbacks until their window ends.
  if (start) return todayKey <= end!;
  return true;
}

function sortBySchedule(a: RightPanelSlideLike, b: RightPanelSlideLike): number {
  const aDate = validDateKey(a.start_date) ?? "9999-12-31";
  const bDate = validDateKey(b.start_date) ?? "9999-12-31";
  return aDate.localeCompare(bDate);
}

/**
 * Decide what the right-hand kiosk panel shows today.
 *
 * - Dated Events happening today take priority.
 * - Otherwise, future/current Conferences and Hackathons are the fallback,
 *   plus undated legacy slides so existing content does not disappear.
 * - Past Conferences/Hackathons and Events outside their date range are hidden.
 */
export function selectVisibleRightSlides(
  slides: RightPanelSlideLike[],
  todayKey: string
): RightPanelSlideLike[] {
  const visible = slides.filter((slide) => slideIsVisibleOn(slide, todayKey));

  const eventsToday = visible
    .filter((slide) => {
      if (categoryOf(slide) !== "Events") return false;
      const start = validDateKey(slide.start_date);
      const end = validDateKey(slide.end_date) ?? start;
      return !!start && todayKey >= start && todayKey <= end!;
    })
    .sort(sortBySchedule);

  if (eventsToday.length > 0) return eventsToday;

  const fallback = visible
    .filter((slide) => categoryOf(slide) !== "Events" || !hasStartDate(slide))
    .sort(sortBySchedule);

  return fallback.length > 0 ? fallback : visible.sort(sortBySchedule);
}

function formatDateKey(value: string): string {
  const [year, month, day] = value.split("-").map(Number);
  return `${day} ${MONTHS[month - 1]} ${year}`;
}

function formatTime(value: string): string {
  const [hourText, minuteText] = value.split(":");
  const hour = Number(hourText);
  if (!Number.isInteger(hour)) return value;
  const suffix = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${displayHour}:${minuteText ?? "00"} ${suffix}`;
}

/** Human-readable date/time range shown in the kiosk right panel. */
export function formatSchedule(
  slide: Pick<RightPanelSlideLike, "start_date" | "end_date" | "start_time" | "end_time">
): string {
  const start = validDateKey(slide.start_date);
  const end = validDateKey(slide.end_date) ?? start;

  let dateText = "";
  if (start && end && start !== end) {
    dateText = `${formatDateKey(start)} – ${formatDateKey(end)}`;
  } else if (start) {
    dateText = formatDateKey(start);
  }

  let timeText = "";
  const startTime = typeof slide.start_time === "string" && slide.start_time ? slide.start_time : null;
  const endTime = typeof slide.end_time === "string" && slide.end_time ? slide.end_time : null;
  if (startTime && endTime) {
    timeText = `${formatTime(startTime)} – ${formatTime(endTime)}`;
  } else if (startTime) {
    timeText = formatTime(startTime);
  }

  return [dateText, timeText].filter(Boolean).join(" · ");
}
