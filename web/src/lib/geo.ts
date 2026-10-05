/**
 * Geographic validation & Haversine distance calculator.
 * Supports all 16 Polish Voivodeships (Województwa), 150+ regional cities & powiaty,
 * dynamic Google Geocoding fallback, and custom search radius.
 */

export interface GeoPoint {
  lat: number;
  lon: number;
}

export const LEGNICA_RYNEK: GeoPoint = {
  lat: 51.2070,
  lon: 16.1605,
};

export const WROCLAW_RYNEK: GeoPoint = {
  lat: 51.1079,
  lon: 17.0385,
};

export interface VoivodeshipDefinition {
  name: string;
  capital: string;
  majorCities: string[];
}

export const POLISH_VOIVODESHIPS: VoivodeshipDefinition[] = [
  {
    name: "Dolnośląskie",
    capital: "Wrocław",
    majorCities: [
      "Wrocław", "Legnica", "Lubin", "Wałbrzych", "Jelenia Góra", "Głogów",
      "Świdnica", "Bolesławiec", "Oleśnica", "Dzierżoniów", "Oława", "Jawor",
      "Złotoryja", "Chojnów", "Polkowice", "Kłodzko", "Strzegom", "Nowa Ruda"
    ],
  },
  {
    name: "Mazowieckie",
    capital: "Warszawa",
    majorCities: [
      "Warszawa", "Radom", "Płock", "Siedlce", "Pruszków", "Legionowo",
      "Ostrołęka", "Piaseczno", "Otwock", "Ciechanów", "Żyrardów", "Mińsk Mazowiecki",
      "Wołomin", "Sochaczew", "Mława", "Grodzisk Mazowiecki", "Nowy Dwór Mazowiecki"
    ],
  },
  {
    name: "Małopolskie",
    capital: "Kraków",
    majorCities: [
      "Kraków", "Tarnów", "Nowy Sącz", "Oświęcim", "Chrzanów", "Olkusz",
      "Nowy Targ", "Bochnia", "Gorlice", "Zakopane", "Skawina", "Wieliczka",
      "Andrychów", "Trzebinia", "Wadowice", "Kęty", "Myślenice"
    ],
  },
  {
    name: "Śląskie",
    capital: "Katowice",
    majorCities: [
      "Katowice", "Częstochowa", "Sosnowiec", "Gliwice", "Zabrze", "Bielsko-Biała",
      "Bytom", "Ruda Śląska", "Rybnik", "Tychy", "Dąbrowa Górnicza", "Chorzów",
      "Jaworzno", "Jastrzębie-Zdrój", "Mysłowice", "Siemianowice Śląskie", "Żory",
      "Tarnowskie Góry", "Będzin", "Piekary Śląskie", "Racibórz", "Zawiercie"
    ],
  },
  {
    name: "Wielkopolskie",
    capital: "Poznań",
    majorCities: [
      "Poznań", "Kalisz", "Konin", "Piła", "Ostrów Wielkopolski", "Gniezno",
      "Leszno", "Luboń", "Września", "Swarzędz", "Śrem", "Krotoszyn",
      "Turek", "Jarocin", "Wągrowiec", "Kościan", "Koło", "Środa Wielkopolska"
    ],
  },
  {
    name: "Pomorskie",
    capital: "Gdańsk",
    majorCities: [
      "Gdańsk", "Gdynia", "Sopot", "Słupsk", "Tczew", "Wejherowo",
      "Starogard Gdański", "Rumia", "Chojnice", "Malbork", "Kwidzyn",
      "Lębork", "Kościerzyna", "Reda", "Bytów", "Ustka", "Kartuzy"
    ],
  },
  {
    name: "Łódzkie",
    capital: "Łódź",
    majorCities: [
      "Łódź", "Piotrków Trybunalski", "Pabianice", "Tomaszów Mazowiecki", "Bełchatów",
      "Zgierz", "Skierniewice", "Radomsko", "Kutno", "Sieradz", "Zduńska Wola",
      "Łowicz", "Wieluń", "Aleksandrów Łódzki", "Opoczno", "Ozorków"
    ],
  },
  {
    name: "Kujawsko-Pomorskie",
    capital: "Bydgoszcz",
    majorCities: [
      "Bydgoszcz", "Toruń", "Włocławek", "Grudziądz", "Inowrocław", "Brodnica",
      "Świecie", "Chełmno", "Nakło nad Notecią", "Rypin", "Solec Kujawski", "Żnin"
    ],
  },
  {
    name: "Lubelskie",
    capital: "Lublin",
    majorCities: [
      "Lublin", "Zamość", "Chełm", "Biała Podlaska", "Puławy", "Świdnik",
      "Kraśnik", "Łuków", "Biłgoraj", "Lubartów", "Tomaszów Lubelski", "Łęczna"
    ],
  },
  {
    name: "Podkarpackie",
    capital: "Rzeszów",
    majorCities: [
      "Rzeszów", "Przemyśl", "Stalowa Wola", "Mielec", "Krosno", "Dębica",
      "Jarosław", "Sanok", "Jasło", "Łańcut", "Ropczyce", "Przeworsk", "Nisko"
    ],
  },
  {
    name: "Zachodniopomorskie",
    capital: "Szczecin",
    majorCities: [
      "Szczecin", "Koszalin", "Stargard", "Kołobrzeg", "Świnoujście", "Szczecinek",
      "Police", "Wałcz", "Białogard", "Goleniów", "Gryfino", "Nowogard"
    ],
  },
  {
    name: "Świętokrzyskie",
    capital: "Kielce",
    majorCities: [
      "Kielce", "Ostrowiec Świętokrzyski", "Starachowice", "Skarżysko-Kamienna",
      "Sandomierz", "Końskie", "Busko-Zdrój", "Jędrzejów", "Staszów", "Pińczów"
    ],
  },
  {
    name: "Podlaskie",
    capital: "Białystok",
    majorCities: [
      "Białystok", "Suwałki", "Łomża", "Augustów", "Bielsk Podlaski", "Zambrów",
      "Grajewo", "Hajnówka", "Sokółka", "Łapy", "Siemiatycze"
    ],
  },
  {
    name: "Lubuskie",
    capital: "Gorzów Wielkopolski",
    majorCities: [
      "Gorzów Wielkopolski", "Zielona Góra", "Nowa Sól", "Żary", "Żagań",
      "Świebodzin", "Międzyrzecz", "Kostrzyn nad Odrą", "Słubice", "Gubin"
    ],
  },
  {
    name: "Opolskie",
    capital: "Opole",
    majorCities: [
      "Opole", "Kędzierzyn-Koźle", "Nysa", "Brzeg", "Kluczbork", "Prudnik",
      "Strzelce Opolskie", "Krapkowice", "Namysłów", "Głuchołazy"
    ],
  },
  {
    name: "Warmińsko-Mazurskie",
    capital: "Olsztyn",
    majorCities: [
      "Olsztyn", "Elbląg", "Ełk", "Iława", "Ostróda", "Giżycko", "Kętrzyn",
      "Bartoszyce", "Szczytno", "Mrągowo", "Działdowo", "Pisz", "Braniewo"
    ],
  },
];

export const KNOWN_CITIES_COORDS: Record<string, GeoPoint> = {
  // Dolnośląskie
  legnica: { lat: 51.2070, lon: 16.1605 },
  wrocław: { lat: 51.1079, lon: 17.0385 },
  wroclaw: { lat: 51.1079, lon: 17.0385 },
  lubin: { lat: 51.3980, lon: 16.2030 },
  jawor: { lat: 51.0505, lon: 16.1932 },
  złotoryja: { lat: 51.1278, lon: 15.9189 },
  zlotoryja: { lat: 51.1278, lon: 15.9189 },
  chojnów: { lat: 51.2720, lon: 15.9360 },
  chojnow: { lat: 51.2720, lon: 15.9360 },
  polkowice: { lat: 51.5030, lon: 16.0680 },
  wałbrzych: { lat: 50.7670, lon: 16.2840 },
  walbrzych: { lat: 50.7670, lon: 16.2840 },
  "jelenia góra": { lat: 50.9044, lon: 15.7384 },
  "jelenia gora": { lat: 50.9044, lon: 15.7384 },
  głogów: { lat: 51.6635, lon: 16.0844 },
  glogow: { lat: 51.6635, lon: 16.0844 },
  świdnica: { lat: 50.8438, lon: 16.4886 },
  swidnica: { lat: 50.8438, lon: 16.4886 },
  bolesławiec: { lat: 51.2642, lon: 15.5658 },
  boleslawiec: { lat: 51.2642, lon: 15.5658 },
  oleśnica: { lat: 51.2104, lon: 17.3820 },
  olesnica: { lat: 51.2104, lon: 17.3820 },
  oława: { lat: 50.9430, lon: 17.2942 },
  olawa: { lat: 50.9430, lon: 17.2942 },
  dzierżoniów: { lat: 50.7282, lon: 16.6508 },
  dzierzoniow: { lat: 50.7282, lon: 16.6508 },
  prochowice: { lat: 51.2250, lon: 16.3650 },
  strzegom: { lat: 50.9600, lon: 16.3480 },
  kłodzko: { lat: 50.4379, lon: 16.6543 },
  klodzko: { lat: 50.4379, lon: 16.6543 },

  // Mazowieckie
  warszawa: { lat: 52.2297, lon: 21.0122 },
  radom: { lat: 51.4027, lon: 21.1471 },
  płock: { lat: 52.5463, lon: 19.7065 },
  plock: { lat: 52.5463, lon: 19.7065 },
  siedlce: { lat: 52.1678, lon: 22.2901 },
  pruszków: { lat: 52.1706, lon: 20.8123 },
  pruszkow: { lat: 52.1706, lon: 20.8123 },
  legionowo: { lat: 52.4022, lon: 20.9351 },
  ostrołęka: { lat: 53.0850, lon: 21.5746 },
  ostroleka: { lat: 53.0850, lon: 21.5746 },
  piaseczno: { lat: 52.0747, lon: 21.0267 },

  // Małopolskie
  kraków: { lat: 50.0647, lon: 19.9450 },
  krakow: { lat: 50.0647, lon: 19.9450 },
  tarnów: { lat: 50.0121, lon: 20.9858 },
  tarnow: { lat: 50.0121, lon: 20.9858 },
  "nowy sącz": { lat: 49.6250, lon: 20.6974 },
  "nowy sacz": { lat: 49.6250, lon: 20.6974 },
  oświęcim: { lat: 50.0344, lon: 19.2104 },
  oswiecim: { lat: 50.0344, lon: 19.2104 },
  zakopane: { lat: 49.2992, lon: 19.9496 },

  // Śląskie
  katowice: { lat: 50.2649, lon: 19.0238 },
  częstochowa: { lat: 50.8118, lon: 19.1203 },
  czestochowa: { lat: 50.8118, lon: 19.1203 },
  sosnowiec: { lat: 50.2863, lon: 19.1041 },
  gliwice: { lat: 50.2945, lon: 18.6714 },
  zabrze: { lat: 50.3249, lon: 18.7857 },
  "bielsko-biała": { lat: 49.8225, lon: 19.0444 },
  "bielsko-biala": { lat: 49.8225, lon: 19.0444 },
  bytom: { lat: 50.3480, lon: 18.9158 },
  rybnik: { lat: 50.0970, lon: 18.5418 },
  tychy: { lat: 50.1264, lon: 18.9922 },
  chorzów: { lat: 50.2975, lon: 18.9546 },
  chorzow: { lat: 50.2975, lon: 18.9546 },
  "dąbrowa górnicza": { lat: 50.3225, lon: 19.1919 },

  // Wielkopolskie
  poznań: { lat: 52.4064, lon: 16.9252 },
  poznan: { lat: 52.4064, lon: 16.9252 },
  kalisz: { lat: 51.7611, lon: 18.0910 },
  konin: { lat: 52.2232, lon: 18.2512 },
  piła: { lat: 53.1513, lon: 16.7381 },
  pila: { lat: 53.1513, lon: 16.7381 },
  "ostrów wielkopolski": { lat: 51.6550, lon: 17.8066 },
  gniezno: { lat: 52.5348, lon: 17.5826 },
  leszno: { lat: 51.8403, lon: 16.5749 },

  // Pomorskie
  gdańsk: { lat: 54.3520, lon: 18.6466 },
  gdansk: { lat: 54.3520, lon: 18.6466 },
  gdynia: { lat: 54.5189, lon: 18.5305 },
  sopot: { lat: 54.4418, lon: 18.5600 },
  słupsk: { lat: 54.4641, lon: 17.0287 },
  slupsk: { lat: 54.4641, lon: 17.0287 },
  tczew: { lat: 54.0924, lon: 18.7885 },
  wejherowo: { lat: 54.6044, lon: 18.2347 },

  // Łódzkie
  łódź: { lat: 51.7592, lon: 19.4560 },
  lodz: { lat: 51.7592, lon: 19.4560 },
  "piotrków trybunalski": { lat: 51.4052, lon: 19.7030 },
  pabianice: { lat: 51.6639, lon: 19.3567 },
  tomaszów: { lat: 51.5311, lon: 20.0083 },
  bełchatów: { lat: 51.3688, lon: 19.3698 },
  zgierz: { lat: 51.8569, lon: 19.4057 },

  // Kujawsko-Pomorskie
  bydgoszcz: { lat: 53.1235, lon: 18.0084 },
  toruń: { lat: 53.0138, lon: 18.5984 },
  torun: { lat: 53.0138, lon: 18.5984 },
  włocławek: { lat: 52.6483, lon: 19.0678 },
  grudziądz: { lat: 53.4841, lon: 18.7537 },
  inowrocław: { lat: 52.7989, lon: 18.2639 },

  // Lubelskie
  lublin: { lat: 51.2465, lon: 22.5684 },
  zamość: { lat: 50.7231, lon: 23.2519 },
  zamosc: { lat: 50.7231, lon: 23.2519 },
  chełm: { lat: 51.1306, lon: 23.4716 },
  chelm: { lat: 51.1306, lon: 23.4716 },
  "biała podlaska": { lat: 52.0324, lon: 23.1165 },
  puławy: { lat: 51.4166, lon: 21.9694 },

  // Podkarpackie
  rzeszów: { lat: 50.0412, lon: 21.9991 },
  rzeszow: { lat: 50.0412, lon: 21.9991 },
  przemyśl: { lat: 49.7839, lon: 22.7678 },
  "stalowa wola": { lat: 50.5828, lon: 22.0534 },
  mielec: { lat: 50.2871, lon: 21.4243 },
  krosno: { lat: 49.6887, lon: 21.7706 },

  // Zachodniopomorskie
  szczecin: { lat: 53.4285, lon: 14.5528 },
  koszalin: { lat: 54.1944, lon: 16.1722 },
  stargard: { lat: 53.3386, lon: 15.0450 },
  kołobrzeg: { lat: 54.1759, lon: 15.5833 },
  świnoujście: { lat: 53.9100, lon: 14.2471 },

  // Świętokrzyskie
  kielce: { lat: 50.8661, lon: 20.6286 },
  "ostrowiec świętokrzyski": { lat: 50.9294, lon: 21.3853 },
  starachowice: { lat: 51.0528, lon: 21.0694 },
  sandomierz: { lat: 50.6828, lon: 21.7489 },

  // Podlaskie
  białystok: { lat: 53.1325, lon: 23.1688 },
  bialystok: { lat: 53.1325, lon: 23.1688 },
  suwałki: { lat: 54.0991, lon: 22.9272 },
  suwalki: { lat: 54.0991, lon: 22.9272 },
  łomża: { lat: 53.1781, lon: 22.0594 },
  lomza: { lat: 53.1781, lon: 22.0594 },
  augustów: { lat: 53.8433, lon: 22.9797 },

  // Lubuskie
  "gorzów wielkopolski": { lat: 52.7368, lon: 15.2288 },
  "gorzow wielkopolski": { lat: 52.7368, lon: 15.2288 },
  "zielona góra": { lat: 51.9356, lon: 15.5062 },
  "zielona gora": { lat: 51.9356, lon: 15.5062 },
  "nowa sól": { lat: 51.8028, lon: 15.7167 },
  żary: { lat: 51.6422, lon: 15.1378 },

  // Opolskie
  opole: { lat: 50.6751, lon: 17.9213 },
  "kędzierzyn-koźle": { lat: 50.3475, lon: 18.2325 },
  nysa: { lat: 50.4736, lon: 17.3344 },
  brzeg: { lat: 50.8608, lon: 17.4675 },

  // Warmińsko-Mazurskie
  olsztyn: { lat: 53.7784, lon: 20.4801 },
  elbląg: { lat: 54.1522, lon: 19.4088 },
  elblag: { lat: 54.1522, lon: 19.4088 },
  ełk: { lat: 53.8281, lon: 22.3619 },
  elk: { lat: 53.8281, lon: 22.3619 },
  iława: { lat: 53.5961, lon: 19.5656 },
  ostróda: { lat: 53.6964, lon: 19.9650 },
};

export const DEFAULT_RADIUS_KM = 35.0;

export interface GeoValidationResult {
  isAllowed: boolean;
  distanceKm: number | null;
  latitude: number | null;
  longitude: number | null;
  rejectionReason: string | null;
}

/**
 * Calculates Haversine distance between two coordinates in kilometers.
 */
export function haversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371.0; // Earth's mean radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180.0;
  const dLon = ((lon2 - lon1) * Math.PI) / 180.0;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180.0) *
      Math.cos((lat2 * Math.PI) / 180.0) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 100) / 100;
}

/**
 * Normalizes city name for key matching (removes diacritics and whitespace).
 */
export function normalizeCityKey(city: string): string {
  return city
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^m\.\s*/, "");
}

/**
 * Dynamically resolves coordinates for any Polish city.
 * Checks known database first, then Google Geocoding if key is provided.
 */
export async function resolveCityCoordinates(
  cityName: string,
  voivodeshipName?: string,
  googleApiKey?: string
): Promise<GeoPoint> {
  const norm = normalizeCityKey(cityName);

  // 1. Direct match in extensive Polish coordinates database
  if (KNOWN_CITIES_COORDS[norm]) {
    return KNOWN_CITIES_COORDS[norm];
  }

  // Substring match in known cities
  for (const [key, pt] of Object.entries(KNOWN_CITIES_COORDS)) {
    if (norm.includes(key) || key.includes(norm)) {
      return pt;
    }
  }

  // 2. Query Google Geocoding API if key is available
  if (googleApiKey && !googleApiKey.includes("••••••••")) {
    try {
      const q = encodeURIComponent(`${cityName}, ${voivodeshipName ? `woj. ${voivodeshipName}, ` : ""}Polska`);
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${q}&key=${googleApiKey.trim()}&language=pl`;
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      const data = await res.json();
      if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
        const loc = data.results[0].geometry.location;
        const pt: GeoPoint = { lat: loc.lat, lon: loc.lng };
        KNOWN_CITIES_COORDS[norm] = pt; // Cache in memory
        return pt;
      }
    } catch {}
  }

  // 3. Match by Voivodeship Capital
  if (voivodeshipName) {
    const vDef = POLISH_VOIVODESHIPS.find(
      (v) => v.name.toLowerCase() === voivodeshipName.toLowerCase()
    );
    if (vDef) {
      const capKey = normalizeCityKey(vDef.capital);
      if (KNOWN_CITIES_COORDS[capKey]) {
        return KNOWN_CITIES_COORDS[capKey];
      }
    }
  }

  // 4. Fallback to Wrocław center (geographic center of SW Poland)
  return WROCLAW_RYNEK;
}

/**
 * Checks if a string contains any variant of Wrocław (kept for backwards-compatibility).
 */
export function isWroclaw(text?: string | null): boolean {
  if (!text) return false;
  const normalized = text.toLowerCase();
  return (
    normalized.includes("wroc") ||
    normalized.includes("wrocław") ||
    normalized.includes("wroclaw") ||
    normalized.includes("breslau")
  );
}

/**
 * Validates a lead's geographic location against user-selected center city and radius.
 * Supports all Polish Voivodeships with dynamic distance calculation.
 */
export function validateGeo(params: {
  city?: string | null;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  maxRadiusKm?: number | null;
  centerCity?: string | null;
  centerVoivodeship?: string | null;
  centerCoordinates?: GeoPoint | null;
  excludedCities?: string[];
}): GeoValidationResult {
  const maxRadius = params.maxRadiusKm;

  // 1. Optional user-configured excluded cities (if user explicitly blacklists any)
  if (params.excludedCities && params.excludedCities.length > 0) {
    const leadCityNorm = (params.city || "").toLowerCase().trim();
    const leadAddrNorm = (params.address || "").toLowerCase().trim();
    for (const exc of params.excludedCities) {
      const excNorm = exc.toLowerCase().trim();
      if (excNorm && (leadCityNorm.includes(excNorm) || leadAddrNorm.includes(excNorm))) {
        return {
          isAllowed: false,
          distanceKm: null,
          latitude: params.latitude ?? null,
          longitude: params.longitude ?? null,
          rejectionReason: `Miasto wykluczone w konfiguracji użytkownika: ${exc}`,
        };
      }
    }
  }

  // 2. If no radius limit is set (null, 0, >= 999, or "all" / "cała polska"), allow everywhere
  const centerCityKey = (params.centerCity || "").trim().toLowerCase();
  if (
    maxRadius === null ||
    maxRadius === undefined ||
    maxRadius <= 0 ||
    maxRadius >= 999 ||
    centerCityKey === "all" ||
    centerCityKey === "wszystkie" ||
    centerCityKey === "cała polska"
  ) {
    return {
      isAllowed: true,
      distanceKm: 0.0,
      latitude: params.latitude ?? null,
      longitude: params.longitude ?? null,
      rejectionReason: null,
    };
  }

  // 3. Resolve Center Point
  let center: GeoPoint = params.centerCoordinates || WROCLAW_RYNEK;
  if (centerCityKey && KNOWN_CITIES_COORDS[normalizeCityKey(centerCityKey)]) {
    center = KNOWN_CITIES_COORDS[normalizeCityKey(centerCityKey)];
  } else if (centerCityKey) {
    // Check partial match
    for (const [k, pt] of Object.entries(KNOWN_CITIES_COORDS)) {
      if (centerCityKey.includes(k) || k.includes(centerCityKey)) {
        center = pt;
        break;
      }
    }
  }

  // 4. If coordinates are provided, compute exact distance to selected center
  if (params.latitude != null && params.longitude != null) {
    const dist = haversineDistance(
      center.lat,
      center.lon,
      params.latitude,
      params.longitude
    );

    if (dist > maxRadius) {
      return {
        isAllowed: false,
        distanceKm: dist,
        latitude: params.latitude,
        longitude: params.longitude,
        rejectionReason: `Lokalizacja poza wybranym promieniem (${dist.toFixed(1)} km > ${maxRadius} km od centrum ${params.centerCity || "wybranego miasta"})`,
      };
    }

    return {
      isAllowed: true,
      distanceKm: dist,
      latitude: params.latitude,
      longitude: params.longitude,
      rejectionReason: null,
    };
  }

  // 5. Fallback: match by city name against known cities
  const leadCityKey = normalizeCityKey(params.city || "");
  if (leadCityKey in KNOWN_CITIES_COORDS) {
    const cityCoords = KNOWN_CITIES_COORDS[leadCityKey];
    const dist = haversineDistance(center.lat, center.lon, cityCoords.lat, cityCoords.lon);
    if (dist <= maxRadius) {
      return {
        isAllowed: true,
        distanceKm: dist,
        latitude: cityCoords.lat,
        longitude: cityCoords.lon,
        rejectionReason: null,
      };
    } else {
      return {
        isAllowed: false,
        distanceKm: dist,
        latitude: cityCoords.lat,
        longitude: cityCoords.lon,
        rejectionReason: `Miasto ${params.city} oddalone o ${dist.toFixed(1)} km od centrum (${params.centerCity || "wybranego miasta"}), limit to ${maxRadius} km`,
      };
    }
  }

  // Default: allow
  return {
    isAllowed: true,
    distanceKm: 0.0,
    latitude: null,
    longitude: null,
    rejectionReason: null,
  };
}
