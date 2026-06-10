import { writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = resolve(__dirname, '../data/flood-crisis-demo-scenario.json');

const start = new Date('2026-07-06T08:00:00+08:00');
let seed = 20260706;

function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
}

function pick(items) {
  return items[Math.floor(random() * items.length)];
}

function timestamp(day, hour = 0, minute = 0) {
  const next = new Date(start);
  next.setDate(start.getDate() + day - 1);
  next.setHours(hour, minute, 0, 0);
  return next.toISOString();
}

function staggeredTimes({ dayStart, dayEnd, count, startHour = 8, endHour = 23, curve = 'linear' }) {
  const times = [];
  const totalHours = (dayEnd - dayStart + 1) * 24;

  for (let index = 0; index < count; index += 1) {
    const ratio = count <= 1 ? 0 : index / (count - 1);
    const shaped =
      curve === 'exponential'
        ? (Math.exp(ratio * 2.2) - 1) / (Math.exp(2.2) - 1)
        : curve === 'cooling'
          ? 1 - Math.pow(1 - ratio, 1.8)
          : ratio;
    const hourOffset = Math.floor(shaped * Math.max(1, totalHours - 1));
    const day = dayStart + Math.floor(hourOffset / 24);
    const hourBase = hourOffset % 24;
    const hour = Math.min(endHour, Math.max(startHour, hourBase || startHour));
    const minute = Math.floor(random() * 54) + 3;
    times.push(timestamp(day, hour, minute));
  }

  return times.sort();
}

const users = [
  ['u-amirah', 'Amirah N.'],
  ['u-joel', 'Joel Tan'],
  ['u-uncle-ray', 'Uncle Ray'],
  ['u-mei', 'Mei Ling'],
  ['u-arjun', 'Arjun K.'],
  ['u-nadya', 'Nadya'],
  ['u-shawn', 'shawn99'],
  ['u-huiwen', 'Hui Wen'],
  ['u-farid', 'Farid'],
  ['u-chloe', 'Chloe W.'],
  ['u-benny', 'Benny'],
  ['u-vanessa', 'Vanessa L.'],
  ['u-ryan', 'ryan_here'],
  ['u-grace', 'Grace Ong'],
  ['u-janice', 'Janice P.'],
  ['u-marcus', 'Marcus'],
  ['u-siti', 'Siti H.'],
  ['u-yx', 'yx'],
  ['u-linda', 'Linda'],
  ['u-daniel', 'Daniel Foo'],
  ['u-kavya', 'Kavya'],
  ['u-zhen', 'Zhen'],
  ['u-nora', 'Nora'],
  ['u-caleb', 'Caleb'],
  ['u-sam', 'Sam'],
  ['u-viv', 'Vivian'],
].map(([id, name]) => ({ id, name, role: 'citizen' }));

const locations = {
  riverValley: { label: 'River Valley', latitude: 1.2937, longitude: 103.8351, planningArea: 'River Valley' },
  orchard: { label: 'Orchard Road', latitude: 1.3048, longitude: 103.8318, planningArea: 'Orchard' },
  marineParade: { label: 'Marine Parade', latitude: 1.3027, longitude: 103.9063, planningArea: 'Marine Parade' },
  rvShelter: { label: 'River Valley Community Centre', latitude: 1.2962, longitude: 103.8344, planningArea: 'River Valley' },
  orchardShelter: { label: 'Library@Orchard relief point', latitude: 1.3041, longitude: 103.8319, planningArea: 'Orchard' },
  marineShelter: { label: 'Marine Parade Community Club', latitude: 1.3049, longitude: 103.9074, planningArea: 'Marine Parade' },
  kallangDepot: { label: 'Kallang logistics depot', latitude: 1.3121, longitude: 103.8723, planningArea: 'Kallang' },
  queenstownHub: { label: 'Queenstown supply hub', latitude: 1.2942, longitude: 103.7861, planningArea: 'Queenstown' },
};

const crisisTags = [
  {
    id: 'tag-flash-flood-rv',
    label: 'Flash flood',
    frameId: 'frame-1',
    categories: ['Flooding', 'Weather'],
    location: locations.riverValley,
    status: 'active',
  },
  {
    id: 'tag-rv-flood',
    label: 'RV flood',
    frameId: 'frame-2',
    categories: ['Flooding', 'Weather', 'Public Safety'],
    location: locations.riverValley,
    status: 'active',
  },
  {
    id: 'tag-orchard-flood',
    label: 'Orchard flood',
    frameId: 'frame-2',
    categories: ['Flooding', 'Transport', 'Public Safety'],
    location: locations.orchard,
    status: 'active',
  },
  {
    id: 'tag-marine-parade-flood',
    label: 'Marine Parade flood',
    frameId: 'frame-2',
    categories: ['Flooding', 'Weather', 'Infrastructure'],
    location: locations.marineParade,
    status: 'active',
  },
  {
    id: 'tag-s-river-valley-cc',
    label: 'S River Valley CC',
    frameId: 'frame-3',
    categories: ['Shelter', 'Flooding', 'Relief'],
    location: locations.rvShelter,
    status: 'shelter',
  },
  {
    id: 'tag-s-orchard-library',
    label: 'S Orchard Library',
    frameId: 'frame-3',
    categories: ['Shelter', 'Flooding', 'Relief'],
    location: locations.orchardShelter,
    status: 'shelter',
  },
  {
    id: 'tag-s-marine-parade-cc',
    label: 'S Marine Parade CC',
    frameId: 'frame-3',
    categories: ['Shelter', 'Flooding', 'Relief'],
    location: locations.marineShelter,
    status: 'shelter',
  },
];

const replyPools = {
  early: [
    'wait is this just ponding or like actual flood?',
    'my shoes are fully soaked lol, pavement outside the condo is basically a stream',
    'please dont drive through if you cant see the kerb, saw one car almost stall',
    'can someone check if the drain cover near the bus stop is blocked?',
    'take pics and report also, this one looks worse than normal rain',
    'i am nearby, water is moving quite fast near the slope',
  ],
  panicAdvice: [
    'guys dont crowd the underpass, there is literally nowhere to go if water rises again',
    'my grab driver cancelled and told me orchard is a mess now',
    'move valuables higher if you are ground floor, sounds obvious but do now not later',
    'anyone know if buses are still running from this stop?',
    'saw staff putting sandbags near the entrance, so maybe avoid that side',
    'for elderly folks please call family now, dont wait until phone battery low',
    'keep power banks charged, my block lights flickered twice',
    'not to scare people but the water is brown and smells bad, dont let kids play there',
    'if you can, share exact location and depth. saying flood everywhere not helpful',
    'i think the canal is near the limit already',
    'please check on basement carparks, that is the scary part',
    'anyone with boots can help move cartons at the shop row?',
    'traffic police just arrived at the junction',
    'avoid sending rumours pls, just say what you actually see',
    'water is around ankle height at my side, knee height nearer the crossing',
    'saw one uncle slip, he is okay but the tiles are super slick',
    'bring umbrella but honestly wind is making it useless',
    'i can shelter two people at the lobby until rain slows',
    'does anyone need a phone charger? i am at the cafe near the corner',
    'dont open manhole covers please, that is dangerous',
  ],
  shelter: [
    'shelter is okay but the queue for hot drinks is pretty long',
    'they need more dry towels, especially for kids',
    'charging points are all taken, maybe bring extension plugs if you have',
    'volunteers are doing their best, please be patient with them',
    'my mum got a seat, thanks to whoever helped us earlier',
    'baby formula running low at the desk from what i heard',
    'there is water but cups are short, bring your bottle',
    'please label your bags, someone nearly took the wrong one',
    'saw a nurse checking minor cuts near the entrance',
    'if you are coming here, use the side gate, front entrance is crowded',
    'food arrived but vegetarian packets disappeared fast',
    'kids corner is helping a lot, whoever set it up thank you',
    'anyone going from Queenstown hub to this shelter? need blankets',
    'it is calmer now, people just tired',
    'phone signal inside is weak, step outside if you need to call',
    'please dont block the wheelchair ramp',
    'one more fan would help, it is getting stuffy',
    'lost and found table has umbrellas and one black backpack',
    'the staff said next supply run is evening',
    'not perfect but at least dry and safe here',
  ],
  cleanup: [
    'mud is everywhere, wear old shoes if you are helping',
    'anyone has extra gloves? the cheap ones tear fast',
    'please dont throw wet electronics into normal bins',
    'lift lobby smells terrible but cleaners are already on it',
    'shop owners need help moving damaged shelves',
    'can we coordinate block by block instead of everyone rushing one place?',
    'my family can help Sunday morning',
    'keep tetanus risk in mind if you get cut',
    'squeegees are more useful than mops right now',
    'some roads still have hidden debris, cycle slowly',
    'saw volunteers clearing leaves from drains, thank you',
    'insurance photos first before tossing things',
    'elderly units still need help carrying wet mattresses',
    'the smell is slowly improving at least',
    'please hydrate, cleanup is hotter than it looks',
  ],
};

function makeReplies({ postId, frameId, pool, count, times }) {
  return Array.from({ length: count }, (_, index) => {
    const user = pick(users);
    return {
      id: `${postId}-reply-${String(index + 1).padStart(2, '0')}`,
      authorId: user.id,
      authorName: user.name,
      content: pick(pool),
      createdAt: times[index],
      likes: Math.floor(random() * (frameId === 'frame-1' ? 5 : frameId === 'frame-2' ? 24 : 18)),
    };
  });
}

const forumPosts = [
  {
    id: 'forum-flood-rv-first-water',
    frameId: 'frame-1',
    title: 'River Valley water rising near the side road',
    authorId: 'u-amirah',
    authorName: 'Amirah N.',
    content: 'Anyone else seeing water rushing down River Valley side road? It started as normal rain but now the drain is overflowing and water is coming over the kerb.',
    createdAt: timestamp(1, 9, 18),
    location: locations.riverValley.label,
    latitude: locations.riverValley.latitude,
    longitude: locations.riverValley.longitude,
    crisisTagIds: ['tag-flash-flood-rv'],
    likes: 9,
    dislikes: 0,
    reports: 0,
    moderationState: 'live',
    replies: makeReplies({
      postId: 'forum-flood-rv-first-water',
      frameId: 'frame-1',
      pool: replyPools.early,
      count: 3,
      times: staggeredTimes({ dayStart: 1, dayEnd: 1, count: 3, startHour: 9, endHour: 13 }),
    }),
  },
  ...[
    ['forum-rv-flood-spreading', 'frame-2', 'RV flood moving toward the smaller lanes', 'u-joel', 'River Valley side streets getting worse. Water is moving toward the shophouses and people are starting to move stuff upstairs.', locations.riverValley, 'tag-rv-flood', 27],
    ['forum-orchard-flood-underpass', 'frame-2', 'Orchard underpass water is not normal', 'u-huiwen', 'Orchard underpass is filling up again. Some people still trying to cross and it is honestly not worth it.', locations.orchard, 'tag-orchard-flood', 26],
    ['forum-marine-parade-flood-shops', 'frame-2', 'Marine Parade shop row flooding too', 'u-farid', 'Marine Parade side has water entering the shop row. Not super deep everywhere but the low spots are bad.', locations.marineParade, 'tag-marine-parade-flood', 24],
  ].map(([id, frameId, title, authorId, content, location, crisisTagId, count], offset) => {
    const author = users.find((user) => user.id === authorId);
    return {
      id,
      frameId,
      title,
      authorId,
      authorName: author?.name ?? 'Citizen',
      content,
      createdAt: timestamp(2, 8 + offset * 3, 12 + offset * 7),
      location: location.label,
      latitude: location.latitude,
      longitude: location.longitude,
      crisisTagIds: [crisisTagId],
      likes: 80 + Math.floor(random() * 60),
      dislikes: Math.floor(random() * 5),
      reports: Math.floor(random() * 3),
      moderationState: 'live',
      replies: makeReplies({
        postId: id,
        frameId,
        pool: replyPools.panicAdvice,
        count,
        times: staggeredTimes({ dayStart: 2, dayEnd: 3, count, startHour: 7, endHour: 23, curve: 'exponential' }),
      }),
    };
  }),
  ...[
    ['forum-shelter-rv-cc-supplies', 'frame-3', 'River Valley CC shelter supply updates', 'u-linda', 'At River Valley CC shelter now. Safe and dry, but towels and hot food are running short. Please update if you are bringing supplies.', locations.rvShelter, 'tag-s-river-valley-cc', 35],
    ['forum-shelter-orchard-library', 'frame-3', 'Orchard shelter queue and needs', 'u-kavya', 'Library@Orchard relief point is crowded but manageable. Main issue is charging spots and dry clothes.', locations.orchardShelter, 'tag-s-orchard-library', 33],
    ['forum-shelter-marine-parade-cc', 'frame-3', 'Marine Parade CC shelter check-in', 'u-zhen', 'Marine Parade CC shelter has families coming in from the lower blocks. They are asking for bottled water and diapers.', locations.marineShelter, 'tag-s-marine-parade-cc', 36],
  ].map(([id, frameId, title, authorId, content, location, crisisTagId, count], offset) => {
    const author = users.find((user) => user.id === authorId);
    return {
      id,
      frameId,
      title,
      authorId,
      authorName: author?.name ?? 'Citizen',
      content,
      createdAt: timestamp(4 + offset, 10, 5 + offset * 11),
      location: location.label,
      latitude: location.latitude,
      longitude: location.longitude,
      crisisTagIds: [crisisTagId],
      likes: 150 + Math.floor(random() * 90),
      dislikes: Math.floor(random() * 8),
      reports: 0,
      moderationState: 'live',
      replies: makeReplies({
        postId: id,
        frameId,
        pool: replyPools.shelter,
        count,
        times: staggeredTimes({ dayStart: 4, dayEnd: 11, count, startHour: 8, endHour: 22, curve: 'cooling' }),
      }),
    };
  }),
  ...[
    ['forum-cleanup-rv-mud', 'frame-4', 'River Valley cleanup help this weekend', 'u-marcus', 'Flood water mostly gone here. Cleanup is the hard part now. Mud in corridors and some elderly neighbours need help moving wet items.', locations.riverValley, 22],
    ['forum-cleanup-orchard-basement', 'frame-4', 'Orchard basement cleanup coordination', 'u-janice', 'Basement shops near Orchard still clearing out. Please bring gloves and dont come if you only have slippers, floor is gross.', locations.orchard, 21],
    ['forum-cleanup-marine-parade-drains', 'frame-4', 'Marine Parade drain and debris cleanup', 'u-siti', 'Marine Parade side is calmer. People are clearing leaves and debris from drains. Need more trash bags, less spectators please.', locations.marineParade, 19],
  ].map(([id, frameId, title, authorId, content, location, count], offset) => {
    const author = users.find((user) => user.id === authorId);
    return {
      id,
      frameId,
      title,
      authorId,
      authorName: author?.name ?? 'Citizen',
      content,
      createdAt: timestamp(12 + offset, 9, 20 + offset * 8),
      location: location.label,
      latitude: location.latitude,
      longitude: location.longitude,
      crisisTagIds: [],
      likes: 55 + Math.floor(random() * 35),
      dislikes: Math.floor(random() * 4),
      reports: 0,
      moderationState: 'resolved',
      replies: makeReplies({
        postId: id,
        frameId,
        pool: replyPools.cleanup,
        count,
        times: staggeredTimes({ dayStart: 12, dayEnd: 20, count, startHour: 8, endHour: 21, curve: 'linear' }),
      }),
    };
  }),
];

const citizenReports = [
  {
    id: 'demo-report-rv-001',
    publicReportId: 'TKT-FLOOD-0001',
    frameId: 'frame-1',
    reporterId: 'u-amirah',
    reporterName: 'Amirah N.',
    title: 'River Valley drain overflowing',
    description: 'Water is flowing over the kerb and pooling outside River Valley side road. Drain looks blocked or overwhelmed.',
    crisisType: 'Weather',
    reportType: 'Flooding',
    severity: 'high',
    status: 'submitted',
    location: locations.riverValley.label,
    latitude: locations.riverValley.latitude,
    longitude: locations.riverValley.longitude,
    crisisTagIds: ['tag-flash-flood-rv'],
    createdAt: timestamp(1, 9, 25),
  },
  ...[
    ['demo-report-rv-002', 'TKT-FLOOD-0002', 'River Valley water entering shops', locations.riverValley, 'tag-rv-flood', 'critical', 'grouped'],
    ['demo-report-orchard-001', 'TKT-FLOOD-0003', 'Orchard underpass flooding', locations.orchard, 'tag-orchard-flood', 'critical', 'grouped'],
    ['demo-report-mp-001', 'TKT-FLOOD-0004', 'Marine Parade shop row flood', locations.marineParade, 'tag-marine-parade-flood', 'high', 'grouped'],
  ].map(([id, publicReportId, title, location, tagId, severity, status], index) => ({
    id,
    publicReportId,
    frameId: 'frame-2',
    reporterId: users[3 + index].id,
    reporterName: users[3 + index].name,
    title,
    description: `${title}. Water level is spreading into nearby pedestrian areas and people are avoiding the low spots.`,
    crisisType: 'Weather',
    reportType: 'Flooding',
    severity,
    status,
    location: location.label,
    latitude: location.latitude,
    longitude: location.longitude,
    crisisTagIds: [tagId],
    createdAt: timestamp(2, 11 + index * 2, 12 + index * 9),
  })),
];

const volunteerProfiles = [
  ['vol-maya', 'Maya Koh', 'Central', ['First Aid', 'Healthcare', 'Community Outreach'], ['Weekdays', 'Evenings'], 'CPR + AED, clinic volunteer'],
  ['vol-isaac', 'Isaac Lim', 'East', ['Driving', 'Logistics', 'Heavy Lifting'], ['Weekends', 'Emergency Only'], 'Class 3 licence, warehouse ops'],
  ['vol-nurul', 'Nurul A.', 'Central', ['Translation', 'Community Outreach', 'Social Work'], ['Weekdays'], 'Malay-English support, family service volunteer'],
  ['vol-terence', 'Terence Ng', 'West', ['IT Support', 'Logistics'], ['Evenings', 'Weekends'], 'Device setup and inventory tracking'],
  ['vol-jiaqi', 'Jia Qi', 'Central', ['First Aid', 'Social Work'], ['Weekends'], 'Shelter welfare volunteer'],
  ['vol-harish', 'Harish Menon', 'East', ['Driving', 'Community Outreach'], ['Emergency Only'], 'Delivery rider, neighbourhood support'],
  ['vol-eileen', 'Eileen Chua', 'Central', ['Healthcare', 'First Aid'], ['Weekdays', 'Emergency Only'], 'Nursing student, first aid team'],
  ['vol-rizal', 'Rizal', 'Any Region', ['Heavy Lifting', 'Logistics'], ['Weekends', 'Evenings'], 'Event setup and relief packing'],
  ['vol-pearl', 'Pearl Wong', 'East', ['Translation', 'Language Support', 'Community Outreach'], ['Weekdays', 'Weekends'], 'Mandarin-English outreach'],
  ['vol-aaron', 'Aaron Teo', 'Central', ['Driving', 'Logistics', 'IT Support'], ['Evenings'], 'Van access after office hours'],
].map(([id, name, region, skills, availability, certifications], index) => ({
  id,
  name,
  phone: `+65 8${String(4300000 + index * 7319).slice(0, 7)}`,
  email: `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/\.$/, '')}@demo.signal.local`,
  region,
  skills,
  availability,
  certifications,
  status: 'verified',
}));

const volunteerOpportunities = [
  ['opp-rv-towels', 'Deliver towels to River Valley CC', 'Kallang logistics depot', locations.rvShelter, ['Logistics', 'Driving'], 9, 5, 'high', 'frame-3', ['tag-s-river-valley-cc']],
  ['opp-orchard-charging', 'Set up charging corner at Orchard shelter', 'Orchard relief desk', locations.orchardShelter, ['IT Support', 'Logistics'], 6, 3, 'medium', 'frame-3', ['tag-s-orchard-library']],
  ['opp-mp-first-aid', 'Minor wound support at Marine Parade CC', 'Marine Parade CC medical table', locations.marineShelter, ['First Aid', 'Healthcare'], 8, 4, 'high', 'frame-3', ['tag-s-marine-parade-cc']],
  ['opp-supply-run-west', 'Supply run from Queenstown hub to shelters', 'Queenstown supply hub', locations.queenstownHub, ['Driving', 'Logistics', 'Heavy Lifting'], 12, 7, 'high', 'frame-3', ['tag-s-river-valley-cc', 'tag-s-orchard-library']],
  ['opp-shelter-guides', 'Shelter queue and family guidance', 'River Valley CC side gate', locations.rvShelter, ['Community Outreach', 'Translation', 'Social Work'], 10, 6, 'medium', 'frame-3', ['tag-s-river-valley-cc']],
  ['opp-cleanup-rv', 'River Valley corridor cleanup team', 'River Valley Community Centre', locations.riverValley, ['Heavy Lifting', 'Community Outreach'], 14, 14, 'medium', 'frame-4', []],
  ['opp-cleanup-orchard', 'Orchard basement cleanup support', 'Orchard relief desk', locations.orchard, ['Heavy Lifting', 'Logistics'], 16, 16, 'medium', 'frame-4', []],
  ['opp-cleanup-mp', 'Marine Parade debris and drain clearing', 'Marine Parade CC', locations.marineParade, ['Heavy Lifting', 'Community Outreach'], 12, 12, 'low', 'frame-4', []],
].map(([id, title, reportingPoint, location, requiredSkills, needed, filled, urgency, frameId, crisisTagIds]) => ({
  id,
  frameId,
  title,
  organization: frameId === 'frame-4' ? 'Community Recovery Team' : 'Flood Relief Coordination Cell',
  location: location.label,
  region: location.planningArea,
  urgency,
  needed,
  filled,
  requiredSkills,
  shift: frameId === 'frame-4' ? '09:00-15:00' : '14:00-20:00',
  reportingPoint,
  crisisTagIds,
  description: frameId === 'frame-4'
    ? 'Cleanup phase support after flood waters receded. Bring covered shoes and avoid handling sharp debris without gloves.'
    : 'Active shelter and supply support while flood response is ongoing. Slots are intentionally not full for the demo.',
}));

function sentimentSeries() {
  const points = [];
  for (let hour = 0; hour < 15; hour += 1) {
    const engagement = Math.round(3 + hour * 1.6 + random() * 5);
    points.push({
      frameId: 'frame-1',
      timestamp: timestamp(1, 8 + hour, Math.floor(random() * 50)),
      granularity: 'hour',
      engagement,
      likes: Math.round(engagement * 0.58),
      replies: Math.round(engagement * 0.34),
      posts: Math.max(1, Math.round(engagement * 0.08)),
      panicScore: Math.min(100, Math.round(18 + hour * 2.4 + random() * 8)),
      helpfulnessScore: Math.round(36 + random() * 14),
    });
  }
  for (let hour = 0; hour < 48; hour += 1) {
    const ratio = hour / 47;
    const engagement = Math.round(24 + 540 * Math.pow(ratio, 2.15) + random() * 35);
    points.push({
      frameId: 'frame-2',
      timestamp: timestamp(2 + Math.floor(hour / 24), hour % 24, Math.floor(random() * 50)),
      granularity: 'hour',
      engagement,
      likes: Math.round(engagement * 0.52),
      replies: Math.round(engagement * 0.41),
      posts: Math.max(2, Math.round(engagement * 0.07)),
      panicScore: Math.min(100, Math.round(45 + 42 * ratio + random() * 8)),
      helpfulnessScore: Math.round(40 + 18 * ratio + random() * 12),
    });
  }
  const frame3 = [610, 760, 880, 820, 760, 700, 640, 570];
  frame3.forEach((engagement, index) => {
    const cooled = index / (frame3.length - 1);
    points.push({
      frameId: 'frame-3',
      timestamp: timestamp(4 + index, 12, 0),
      granularity: 'day',
      engagement,
      likes: Math.round(engagement * 0.6),
      replies: Math.round(engagement * 0.34),
      posts: Math.max(4, Math.round(engagement * 0.06)),
      panicScore: Math.round(68 - cooled * 22 + random() * 5),
      helpfulnessScore: Math.round(58 + cooled * 21 + random() * 6),
    });
  });
  const frame4 = [430, 390, 350, 330, 305, 285, 270, 250, 235];
  frame4.forEach((engagement, index) => {
    points.push({
      frameId: 'frame-4',
      timestamp: timestamp(12 + index, 12, 0),
      granularity: 'day',
      engagement,
      likes: Math.round(engagement * 0.57),
      replies: Math.round(engagement * 0.35),
      posts: Math.max(3, Math.round(engagement * 0.08)),
      panicScore: Math.round(38 - index * 1.7 + random() * 4),
      helpfulnessScore: Math.round(72 + random() * 8),
    });
  });
  return points;
}

const scenario = {
  id: 'long-flooding-demo',
  title: 'Long Flooding Simulated Crisis',
  description: 'Local demo data for a staged long flooding crisis pitch. Data is not wired into the app yet.',
  startsAt: start.toISOString(),
  frames: [
    {
      id: 'frame-1',
      label: 'First signal',
      dayRange: [1, 1],
      displayGranularity: 'hour',
      narrative: 'Crisis just started. Government has no official picture yet; first indication comes from River Valley citizen forum chatter and one report.',
    },
    {
      id: 'frame-2',
      label: 'Multi-location escalation',
      dayRange: [2, 3],
      displayGranularity: 'hour',
      narrative: 'Flooding is now visible at River Valley, Orchard, and Marine Parade. Forums show panic, road disruption, and useful citizen advice.',
    },
    {
      id: 'frame-3',
      label: 'Shelter and relief response',
      dayRange: [4, 11],
      displayGranularity: 'day',
      narrative: 'Flood location tags are superseded by shelter crisis tags. Forum activity focuses on shelter conditions, supplies, comfort, and volunteer support.',
    },
    {
      id: 'frame-4',
      label: 'Subsiding and cleanup',
      dayRange: [12, 20],
      displayGranularity: 'day',
      narrative: 'Flood is subsiding. Forum activity cools to about one-third of peak and moves toward cleanup help. Forum posts no longer carry crisis tags.',
    },
  ],
  actors: users,
  crisisTags,
  forumPosts,
  citizenReports,
  volunteerProfiles,
  volunteerOpportunities,
  sentimentSeries: sentimentSeries(),
};

await writeFile(outputPath, `${JSON.stringify(scenario, null, 2)}\n`, 'utf8');
console.log(`Wrote ${outputPath}`);
console.log(`Forum posts: ${scenario.forumPosts.length}`);
console.log(`Replies: ${scenario.forumPosts.reduce((sum, post) => sum + post.replies.length, 0)}`);
console.log(`Crisis tags: ${scenario.crisisTags.length}`);
console.log(`Volunteer opportunities: ${scenario.volunteerOpportunities.length}`);
