import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  getWarsawDate,
  getEasterSunday,
  getPolishHolidays,
  isPolishPublicHoliday,
  isWithinSendingWindow,
  addPolishBusinessDays,
} from "../src/lib/polish-calendar";

describe("Polish Calendar & Sending Window Invariants", () => {
  it("correctly calculates Easter Sunday via Meeus algorithm", () => {
    // Known historical & future Easter Sunday dates:
    // 2024: March 31
    // 2025: April 20
    // 2026: April 5
    // 2027: March 28
    const easter2024 = getEasterSunday(2024);
    assert.deepEqual(easter2024, { month: 3, day: 31 });

    const easter2025 = getEasterSunday(2025);
    assert.deepEqual(easter2025, { month: 4, day: 20 });

    const easter2026 = getEasterSunday(2026);
    assert.deepEqual(easter2026, { month: 4, day: 5 });

    const easter2027 = getEasterSunday(2027);
    assert.deepEqual(easter2027, { month: 3, day: 28 });
  });

  it("identifies all statutory Polish public holidays for 2026", () => {
    const holidays2026 = getPolishHolidays(2026);
    
    // Fixed statutory holidays
    assert.ok(holidays2026.has("01-01"), "Nowy Rok");
    assert.ok(holidays2026.has("01-06"), "Trzech Króli");
    assert.ok(holidays2026.has("05-01"), "Święto Pracy");
    assert.ok(holidays2026.has("05-03"), "Święto Konstytucji 3 Maja");
    assert.ok(holidays2026.has("08-15"), "Wniebowzięcie NMP");
    assert.ok(holidays2026.has("11-01"), "Wszystkich Świętych");
    assert.ok(holidays2026.has("11-11"), "Święto Niepodległości");
    assert.ok(holidays2026.has("12-25"), "Boże Narodzenie 1");
    assert.ok(holidays2026.has("12-26"), "Boże Narodzenie 2");

    // Moveable holidays in 2026
    // Easter Monday: April 6, 2026
    assert.ok(holidays2026.has("04-06"), "Poniedziałek Wielkanocny 2026");
    // Boże Ciało: June 4, 2026 (Easter + 60 days)
    assert.ok(holidays2026.has("06-04"), "Boże Ciało 2026");

    // Regular working day is not a holiday
    assert.ok(!holidays2026.has("04-07"), "Regular Tuesday is not a holiday");
    assert.ok(!holidays2026.has("06-05"), "Day after Corpus Christi is not a statutory holiday");
  });

  it("isPolishPublicHoliday accurately recognizes holidays", () => {
    // 2026-01-01 is Thursday holiday
    const newYear = new Date("2026-01-01T12:00:00Z");
    assert.equal(isPolishPublicHoliday(newYear), true);

    // 2026-04-06 is Easter Monday
    const easterMon = new Date("2026-04-06T10:00:00Z");
    assert.equal(isPolishPublicHoliday(easterMon), true);

    // 2026-04-07 is regular Tuesday
    const regularTue = new Date("2026-04-07T10:00:00Z");
    assert.equal(isPolishPublicHoliday(regularTue), false);
  });

  it("converts dates to Europe/Warsaw timezone reliably in getWarsawDate", () => {
    // 2026-06-15T08:00:00Z in UTC is 10:00 in Warsaw (CEST, UTC+2)
    const summerDate = new Date("2026-06-15T08:00:00Z");
    const warsawSummer = getWarsawDate(summerDate);
    assert.equal(warsawSummer.hours, 10);
    assert.equal(warsawSummer.dayOfWeek, 1); // Monday

    // 2026-01-15T08:00:00Z in UTC is 09:00 in Warsaw (CET, UTC+1)
    const winterDate = new Date("2026-01-15T08:00:00Z");
    const warsawWinter = getWarsawDate(winterDate);
    assert.equal(warsawWinter.hours, 9);
    assert.equal(warsawWinter.dayOfWeek, 4); // Thursday
  });

  it("enforces Monday-Friday 08:30-16:00 sending window", () => {
    // Regular Tuesday at 10:00 Warsaw time (08:00 UTC during CEST)
    const validTuesday = new Date("2026-04-07T08:00:00Z");
    const checkValid = isWithinSendingWindow(validTuesday);
    assert.equal(checkValid.allowed, true);

    // Early morning before 08:30 (06:00 UTC = 08:00 Warsaw CEST)
    const tooEarly = new Date("2026-04-07T06:00:00Z");
    const checkTooEarly = isWithinSendingWindow(tooEarly);
    assert.equal(checkTooEarly.allowed, false);
    assert.match(checkTooEarly.reason || "", /poza oknem/i);

    // Evening after 16:00 (15:00 UTC = 17:00 Warsaw CEST)
    const tooLate = new Date("2026-04-07T15:00:00Z");
    const checkTooLate = isWithinSendingWindow(tooLate);
    assert.equal(checkTooLate.allowed, false);
    assert.match(checkTooLate.reason || "", /poza oknem/i);

    // Saturday
    const saturday = new Date("2026-04-11T10:00:00Z");
    const checkSat = isWithinSendingWindow(saturday);
    assert.equal(checkSat.allowed, false);
    assert.match(checkSat.reason || "", /weekend/i);

    // Sunday
    const sunday = new Date("2026-04-12T10:00:00Z");
    const checkSun = isWithinSendingWindow(sunday);
    assert.equal(checkSun.allowed, false);
    assert.match(checkSun.reason || "", /weekend/i);

    // Statutory Holiday (Easter Monday, 2026-04-06)
    const holiday = new Date("2026-04-06T09:00:00Z");
    const checkHoliday = isWithinSendingWindow(holiday);
    assert.equal(checkHoliday.allowed, false);
    assert.match(checkHoliday.reason || "", /święto/i);
  });

  it("addPolishBusinessDays correctly skips weekends and statutory holidays", () => {
    // Start on Wednesday 2026-04-01 + 2 business days -> Friday 2026-04-03
    const startWed = new Date("2026-04-01T09:00:00Z");
    const plusTwo = addPolishBusinessDays(startWed, 2);
    const wPlusTwo = getWarsawDate(plusTwo);
    assert.equal(wPlusTwo.dateString, "2026-04-03");

    // Start on Friday 2026-04-03 + 1 business day
    // Sat 04-04: Weekend
    // Sun 04-05: Weekend (Easter)
    // Mon 04-06: Statutory Holiday (Easter Monday)
    // Next business day MUST BE Tuesday 2026-04-07!
    const startFri = new Date("2026-04-03T09:00:00Z");
    const plusOne = addPolishBusinessDays(startFri, 1);
    const wPlusOne = getWarsawDate(plusOne);
    assert.equal(wPlusOne.dateString, "2026-04-07");
    assert.equal(wPlusOne.dayOfWeek, 2); // Tuesday
  });
});
