type Locality = {
  name: string;
  latitude: number;
  longitude: number;
  aliases: string[];
};

export type SingaporeAreaGroup = {
  id: 'north' | 'east' | 'south' | 'west' | 'central';
  label: 'North' | 'East' | 'South' | 'West' | 'Central';
  areas: string[];
};

const localities: Locality[] = [
  { name: 'Clementi', latitude: 1.3151, longitude: 103.7650, aliases: ['clementi'] },
  { name: 'Jurong East', latitude: 1.3329, longitude: 103.7436, aliases: ['jurong east'] },
  { name: 'Jurong West', latitude: 1.3496, longitude: 103.7060, aliases: ['jurong west'] },
  { name: 'Bukit Batok', latitude: 1.3495, longitude: 103.7494, aliases: ['bukit batok'] },
  { name: 'Woodlands', latitude: 1.4382, longitude: 103.7890, aliases: ['woodlands'] },
  { name: 'Punggol', latitude: 1.4043, longitude: 103.9020, aliases: ['punggol'] },
  { name: 'Ang Mo Kio', latitude: 1.3691, longitude: 103.8454, aliases: ['ang mo kio', 'amk'] },
  { name: 'Orchard', latitude: 1.3048, longitude: 103.8318, aliases: ['orchard', 'orchard road'] },
  { name: 'Bedok', latitude: 1.3236, longitude: 103.9273, aliases: ['bedok'] },
  { name: 'Bedok North', latitude: 1.3347, longitude: 103.9189, aliases: ['bedok north'] },
  { name: 'Tampines', latitude: 1.3496, longitude: 103.9568, aliases: ['tampines', 'tampines hub'] },
  { name: 'East Coast', latitude: 1.3018, longitude: 103.9123, aliases: ['east coast', 'east coast park'] },
  { name: 'Marina Bay', latitude: 1.2823, longitude: 103.8585, aliases: ['marina bay'] },
  { name: 'Toa Payoh', latitude: 1.3323, longitude: 103.8474, aliases: ['toa payoh'] },
  { name: 'Hougang', latitude: 1.3619, longitude: 103.8860, aliases: ['hougang'] },
  { name: 'Pasir Ris', latitude: 1.3731, longitude: 103.9493, aliases: ['pasir ris'] },
];

export const singaporeAreaGroups: SingaporeAreaGroup[] = [
  {
    id: 'north',
    label: 'North',
    areas: [
      'Ang Mo Kio',
      'Central Water Catchment',
      'Hougang',
      'Lim Chu Kang',
      'Mandai',
      'North-Eastern Islands',
      'Punggol',
      'Seletar',
      'Sembawang',
      'Sengkang',
      'Serangoon',
      'Simpang',
      'Sungei Kadut',
      'Woodlands',
      'Yishun',
    ],
  },
  {
    id: 'east',
    label: 'East',
    areas: [
      'Bedok',
      'Changi',
      'Changi Bay',
      'Pasir Ris',
      'Paya Lebar',
      'Tampines',
    ],
  },
  {
    id: 'south',
    label: 'South',
    areas: [
      'Bukit Merah',
      'Downtown Core',
      'Marina East',
      'Marina South',
      'Outram',
      'Southern Islands',
      'Straits View',
    ],
  },
  {
    id: 'west',
    label: 'West',
    areas: [
      'Boon Lay',
      'Bukit Batok',
      'Bukit Panjang',
      'Choa Chu Kang',
      'Clementi',
      'Jurong East',
      'Jurong West',
      'Pioneer',
      'Tengah',
      'Tuas',
      'Western Islands',
      'Western Water Catchment',
    ],
  },
  {
    id: 'central',
    label: 'Central',
    areas: [
      'Bishan',
      'Bukit Timah',
      'Geylang',
      'Kallang',
      'Marine Parade',
      'Museum',
      'Newton',
      'Novena',
      'Orchard',
      'Queenstown',
      'River Valley',
      'Rochor',
      'Singapore River',
      'Tanglin',
      'Toa Payoh',
    ],
  },
];

const regionalFallbacks: Record<string, Locality[]> = {
  nationwide: [findLocality('Jurong East'), findLocality('Orchard'), findLocality('Bedok'), findLocality('Woodlands')],
  west: [findLocality('Jurong East'), findLocality('Clementi'), findLocality('Bukit Batok')],
  east: [findLocality('Bedok'), findLocality('Tampines'), findLocality('East Coast')],
  north: [findLocality('Woodlands'), findLocality('Ang Mo Kio')],
  south: [findLocality('Marina Bay'), findLocality('Orchard')],
  central: [findLocality('Orchard'), findLocality('Toa Payoh'), findLocality('Marina Bay')],
};

type ResolvedLocation = {
  name: string;
  latitude: number;
  longitude: number;
};

function findLocality(name: string) {
  const match = localities.find((item) => item.name === name);
  if (!match) throw new Error(`Missing locality mapping for ${name}`);
  return match;
}

function normalized(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s/,&-]/g, ' ');
}

export function resolveAlertLocations(...parts: Array<string | null | undefined>): ResolvedLocation[] {
  const haystack = normalized(parts.filter(Boolean).join(' '));
  const exactMatches = localities.filter((locality) => locality.aliases.some((alias) => haystack.includes(alias)));

  if (exactMatches.length > 0) {
    return dedupe(exactMatches).map(toResolvedLocation);
  }

  const fallbacks: Locality[] = [];
  if (haystack.includes('east/central') || haystack.includes('east / central')) {
    fallbacks.push(...regionalFallbacks.east, ...regionalFallbacks.central);
  } else {
    if (haystack.includes('west')) fallbacks.push(...regionalFallbacks.west);
    if (haystack.includes('east')) fallbacks.push(...regionalFallbacks.east);
    if (haystack.includes('north')) fallbacks.push(...regionalFallbacks.north);
    if (haystack.includes('south')) fallbacks.push(...regionalFallbacks.south);
    if (haystack.includes('central')) fallbacks.push(...regionalFallbacks.central);
    if (haystack.includes('nationwide') || haystack.includes('all')) fallbacks.push(...regionalFallbacks.nationwide);
  }

  return dedupe(fallbacks.length > 0 ? fallbacks : regionalFallbacks.nationwide).map(toResolvedLocation);
}

function toResolvedLocation(item: Locality): ResolvedLocation {
  return { name: item.name, latitude: item.latitude, longitude: item.longitude };
}

function dedupe(items: Locality[]) {
  return items.filter((item, index, all) => all.findIndex((candidate) => candidate.name === item.name) === index);
}
