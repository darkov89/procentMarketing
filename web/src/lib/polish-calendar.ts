/**
 * Polish Calendar & Working Hours Utilities.
 * Handles:
 * - Warsaw timezone conversion
 * - Monday-Friday 08:30 - 16:00 window
 * - Static and moveable Polish statutory public holidays (Dni wolne od pracy wg ustawy)
 */

export function getWarsawDate(date: Date = new Date()): {
  year: number;
  month: number; // 1-12
  day: number;
  hours: number;
  minutes: number;
  dayOfWeek: number; // 0 (Sun) - 6 (Sat)
  dateString: string; // YYYY-MM-DD
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Warsaw",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = parseInt(part.value, 10);
    }
  }

  // Calculate day of week in Warsaw timezone
  const warsawMidnight = new Date(Date.UTC(map.year, map.month - 1, map.day));
  const dayOfWeek = warsawMidnight.getUTCDay();

  const monthStr = String(map.month).padStart(2, "0");
  const dayStr = String(map.day).padStart(2, "0");

  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hours: map.hour,
    minutes: map.minute,
    dayOfWeek,
    dateString: `${map.year}-${monthStr}-${dayStr}`,
  };
}

/**
 * Calculates Easter Sunday for a given Gregorian year (Meeus/Jones/Butcher algorithm)
 */
export function getEasterSunday(year: number): { month: number; day: number } {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;

  return { month, day };
}

/**
 * Returns set of Polish public holidays for a given year in "MM-DD" format.
 */
export function getPolishHolidays(year: number): Set<string> {
  const holidays = new Set<string>([
    "01-01", // Nowy Rok
    "01-06", // Trzech Króli
    "05-01", // Święto Pracy
    "05-03", // Święto Konstytucji 3 Maja
    "08-15", // Wniebowzięcie NMP / Święto Wojska Polskiego
    "11-01", // Wszystkich Świętych
    "11-11", // Święto Niepodległości
    "12-25", // Boże Narodzenie (dzień 1)
    "12-26", // Boże Narodzenie (dzień 2)
  ]);

  // Moveable holidays based on Easter
  const easter = getEasterSunday(year);
  const easterDate = new Date(Date.UTC(year, easter.month - 1, easter.day));

  // Poniedziałek Wielkanocny (Easter + 1 day)
  const easterMonday = new Date(easterDate.getTime() + 1 * 24 * 60 * 60 * 1000);
  holidays.add(
    `${String(easterMonday.getUTCMonth() + 1).padStart(2, "0")}-${String(
      easterMonday.getUTCDate()
    ).padStart(2, "0")}`
  );

  // Zielone Świątki (Easter + 49 days - always Sunday, but legally a holiday)
  const pentecost = new Date(easterDate.getTime() + 49 * 24 * 60 * 60 * 1000);
  holidays.add(
    `${String(pentecost.getUTCMonth() + 1).padStart(2, "0")}-${String(
      pentecost.getUTCDate()
    ).padStart(2, "0")}`
  );

  // Boże Ciało (Easter + 60 days - Thursday)
  const corpusChristi = new Date(easterDate.getTime() + 60 * 24 * 60 * 60 * 1000);
  holidays.add(
    `${String(corpusChristi.getUTCMonth() + 1).padStart(2, "0")}-${String(
      corpusChristi.getUTCDate()
    ).padStart(2, "0")}`
  );

  return holidays;
}

/**
 * Checks if a given date is a Polish statutory public holiday.
 */
export function isPolishPublicHoliday(date: Date = new Date()): boolean {
  const w = getWarsawDate(date);
  const holidays = getPolishHolidays(w.year);
  const mmDd = `${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
  return holidays.has(mmDd);
}

/**
 * Checks if the current time is within the allowed Polish sending window:
 * - Monday to Friday (dayOfWeek 1-5)
 * - 08:30 to 16:00 Europe/Warsaw
 * - Not a Polish public holiday
 */
export function isWithinSendingWindow(date: Date = new Date()): {
  allowed: boolean;
  reason?: string;
  warsawTime: string;
} {
  const w = getWarsawDate(date);
  const warsawTime = `${w.dateString} ${String(w.hours).padStart(2, "0")}:${String(
    w.minutes
  ).padStart(2, "0")} CET/CEST`;

  // 1. Weekend check
  if (w.dayOfWeek === 0 || w.dayOfWeek === 6) {
    return {
      allowed: false,
      reason: `Wysyłka zablokowana: weekend (sobota/niedziela). Czas PL: ${warsawTime}`,
      warsawTime,
    };
  }

  // 2. Polish Public Holiday check
  const holidays = getPolishHolidays(w.year);
  const mmDd = `${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
  if (holidays.has(mmDd)) {
    return {
      allowed: false,
      reason: `Wysyłka zablokowana: polskie święto państwowe/kościelne (${mmDd}). Czas PL: ${warsawTime}`,
      warsawTime,
    };
  }

  // 3. Time window check (08:30 - 16:00)
  const totalMinutes = w.hours * 60 + w.minutes;
  const startMinutes = 8 * 60 + 30; // 08:30
  const endMinutes = 16 * 60; // 16:00

  if (totalMinutes < startMinutes || totalMinutes >= endMinutes) {
    return {
      allowed: false,
      reason: `Wysyłka zablokowana: poza oknem wysyłkowym (08:30–16:00 czasu polskiego). Czas PL: ${warsawTime}`,
      warsawTime,
    };
  }

  return {
    allowed: true,
    warsawTime,
  };
}

/**
 * Adds business days (excluding weekends and Polish public holidays) in Warsaw timezone.
 */
export function addPolishBusinessDays(startDate: Date, businessDays: number): Date {
  let current = new Date(startDate.getTime());
  let added = 0;

  while (added < businessDays) {
    current = new Date(current.getTime() + 24 * 60 * 60 * 1000);
    const w = getWarsawDate(current);
    if (w.dayOfWeek === 0 || w.dayOfWeek === 6) continue;

    const holidays = getPolishHolidays(w.year);
    const mmDd = `${String(w.month).padStart(2, "0")}-${String(w.day).padStart(2, "0")}`;
    if (holidays.has(mmDd)) continue;

    added++;
  }

  return current;
}
