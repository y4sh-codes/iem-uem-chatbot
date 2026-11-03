import test from "node:test";
import assert from "node:assert/strict";
import {
  selectVisibleRightSlides,
  formatSchedule,
  normalizeCategory,
  parseScheduleInput,
  type RightPanelSlideLike,
} from "./eventSchedule";

function slide(overrides: Partial<RightPanelSlideLike>): RightPanelSlideLike {
  return {
    title: "Slide",
    subtitle: "",
    details: "",
    category: "Events",
    ...overrides,
  };
}

test("normalizeCategory falls back to Events for unknown and missing values", () => {
  assert.equal(normalizeCategory("Conference"), "Conference");
  assert.equal(normalizeCategory("Hackathons"), "Hackathons");
  assert.equal(normalizeCategory("Events"), "Events");
  assert.equal(normalizeCategory("Something else"), "Events");
  assert.equal(normalizeCategory(undefined), "Events");
});

test("a single-day Event is visible only on its date", () => {
  const event = slide({ title: "Single", start_date: "2026-11-08", end_date: "2026-11-08" });
  assert.deepEqual(
    selectVisibleRightSlides([event], "2026-11-07").map((s) => s.title),
    []
  );
  assert.deepEqual(
    selectVisibleRightSlides([event], "2026-11-08").map((s) => s.title),
    ["Single"]
  );
  assert.deepEqual(
    selectVisibleRightSlides([event], "2026-11-09").map((s) => s.title),
    []
  );
});

test("a date-range Event is visible on its start, middle, and end dates", () => {
  const event = slide({ title: "Range", start_date: "2026-11-08", end_date: "2026-11-10" });
  for (const day of ["2026-11-08", "2026-11-09", "2026-11-10"]) {
    assert.deepEqual(
      selectVisibleRightSlides([event], day).map((s) => s.title),
      ["Range"],
      day
    );
  }
});

test("an Event with no date stays visible for backward compatibility", () => {
  const legacy = slide({ title: "Legacy", category: "Events" });
  assert.deepEqual(
    selectVisibleRightSlides([legacy], "2030-01-01").map((s) => s.title),
    ["Legacy"]
  );
});

test("future Conference and Hackathons slides survive the fallback filter", () => {
  const conference = slide({
    title: "Conf",
    category: "Conference",
    start_date: "2026-12-01",
    end_date: "2026-12-02",
  });
  const hackathon = slide({
    title: "Hack",
    category: "Hackathons",
    start_date: "2026-11-08",
    end_date: "2026-11-20",
  });
  assert.deepEqual(
    selectVisibleRightSlides([conference, hackathon], "2026-11-10").map((s) => s.title),
    ["Hack", "Conf"]
  );
});

test("past Conference and Hackathons slides are removed", () => {
  const past = slide({
    title: "Past conf",
    category: "Conference",
    start_date: "2026-10-01",
    end_date: "2026-10-02",
  });
  const pastHack = slide({
    title: "Past hack",
    category: "Hackathons",
    start_date: "2026-10-01",
    end_date: "2026-10-02",
  });
  assert.deepEqual(selectVisibleRightSlides([past, pastHack], "2026-11-03"), []);
});

test("a dated Event today takes priority over Conference/Hackathons", () => {
  const event = slide({ title: "Today", start_date: "2026-11-08", end_date: "2026-11-08" });
  const conference = slide({ title: "Conf", category: "Conference" });
  const hackathon = slide({ title: "Hack", category: "Hackathons" });
  assert.deepEqual(
    selectVisibleRightSlides([conference, event, hackathon], "2026-11-08").map((s) => s.title),
    ["Today"]
  );
});

test("with no event today, Conference/Hackathons and undated legacy slides are shown", () => {
  const legacy = slide({ title: "Legacy", category: "Events" });
  const conference = slide({ title: "Conf", category: "Conference" });
  const hackathon = slide({ title: "Hack", category: "Hackathons" });
  assert.deepEqual(
    selectVisibleRightSlides([conference, legacy, hackathon], "2026-11-08").map((s) => s.title),
    ["Conf", "Legacy", "Hack"]
  );
});

test("formatSchedule renders a single date with a time range", () => {
  const value = formatSchedule({
    start_date: "2026-11-08",
    start_time: "10:00",
    end_time: "12:30",
  });
  assert.equal(value, "8 Nov 2026 · 10:00 AM – 12:30 PM");
});

test("formatSchedule renders an inclusive date range", () => {
  const value = formatSchedule({
    start_date: "2026-11-08",
    end_date: "2026-11-10",
  });
  assert.equal(value, "8 Nov 2026 – 10 Nov 2026");
});

test("parseScheduleInput normalizes a valid range", () => {
  assert.deepEqual(
    parseScheduleInput({
      category: "Hackathons",
      start_date: "2026-11-08",
      end_date: "2026-11-10",
      start_time: "09:00",
      end_time: "17:30",
    }),
    {
      category: "Hackathons",
      start_date: "2026-11-08",
      end_date: "2026-11-10",
      start_time: "09:00",
      end_time: "17:30",
    }
  );
});

test("parseScheduleInput defaults the category and turns blanks into null", () => {
  assert.deepEqual(parseScheduleInput({ category: "", start_date: "", end_date: "", start_time: "", end_time: "" }), {
    category: "Events",
    start_date: null,
    end_date: null,
    start_time: null,
    end_time: null,
  });
});

test("parseScheduleInput rejects an invalid date", () => {
  assert.deepEqual(parseScheduleInput({ start_date: "08/11/2026" }), {
    error: "start_date must be a valid YYYY-MM-DD date",
  });
});

test("parseScheduleInput rejects an end date before the start date", () => {
  assert.deepEqual(parseScheduleInput({ start_date: "2026-11-10", end_date: "2026-11-08" }), {
    error: "end_date cannot be before start_date",
  });
});

test("parseScheduleInput rejects an invalid time", () => {
  assert.deepEqual(parseScheduleInput({ start_time: "9am" }), {
    error: "start_time must be a valid HH:MM time",
  });
});
