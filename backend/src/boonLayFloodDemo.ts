import { clearDemoForumPosts, clearForumPostsMatching, upsertDemoForumPost } from './forumRepository.js';
import {
  addTicketComment,
  createCitizenTicket,
  createReportSubjectTag,
  pingTicketAgencies,
  type Ticket,
} from './ticketRepository.js';
import { pool, query } from './db.js';

const demoMarker = '[DEMO:BOON-LAY-FLOOD]';
const demoForumPostIds = [
  'demo-boon-lay-flood-main',
  'demo-boon-lay-flood-jurong-west-st-64',
  'demo-boon-lay-flood-bus-stop',
];

type DemoSeedResult = {
  createdReports: Ticket[];
  forumPostIds: string[];
};

const reportInputs = [
  {
    forumPostId: 'demo-boon-lay-flood-main',
    reporter: 'Wei Ming - Boon Lay Ave',
    message: 'Water has risen to ankle height near Boon Lay Avenue and is still flowing across the pedestrian crossing. Cars are slowing sharply and residents are turning back.',
    location: 'Boon Lay Avenue near Boon Lay Place Market, West',
    latitude: 1.3459,
    longitude: 103.7118,
    urgency: 'high' as const,
    likes: 8,
  },
  {
    forumPostId: 'demo-boon-lay-flood-jurong-west-st-64',
    reporter: 'Nurul - Jurong West St 64',
    message: 'Drain overflow beside Jurong West Street 64. Water is spreading toward the bus stop and two elderly residents needed help crossing the sheltered walkway.',
    location: 'Jurong West Street 64, near Boon Lay MRT, West',
    latitude: 1.3389,
    longitude: 103.7058,
    urgency: 'high' as const,
    likes: 11,
  },
  {
    forumPostId: 'demo-boon-lay-flood-bus-stop',
    reporter: 'Siti - Bus 240',
    message: 'Bus stop near Boon Lay Interchange is crowded because the road outside is flooded and buses are slowing. People are asking whether there will be diversions.',
    location: 'Boon Lay Bus Interchange, West',
    latitude: 1.3395,
    longitude: 103.7065,
    urgency: 'medium' as const,
    likes: 6,
  },
];

export async function seedBoonLayFloodInflux(options: { reset?: boolean } = {}): Promise<DemoSeedResult> {
  if (options.reset) {
    await clearExistingBoonLayFloodDemo();
  }

  const subjectTag = await createReportSubjectTag({
    label: 'Boon Lay Flooding',
    description: 'Fast-rising floodwater, road disruption, and shelter support around Boon Lay.',
    categories: ['flood', 'weather', 'transport', 'infrastructure'],
  });

  const createdReports: Ticket[] = [];
  const forumPostIds: string[] = [];

  for (const [index, input] of reportInputs.entries()) {
    const ticket = await createCitizenTicket({
      reporter: input.reporter,
      title: 'Boon Lay Flooding',
      message: input.message,
      location: input.location,
      latitude: input.latitude,
      longitude: input.longitude,
      crisisType: 'environment',
      reportType: 'Boon Lay Flooding',
      urgency: input.urgency,
      subjectTagId: subjectTag?.id ?? null,
    });
    if (!ticket) continue;

    await addTicketComment(ticket.id, {
      body: index === 0
        ? `${demoMarker} Grouped into the Boon Lay Flooding demo case for PUB review.`
        : `${demoMarker} Likely duplicate/related Boon Lay flooding report. Review with nearby submissions and road disruption.`,
      visibility: 'internal',
      author: 'SiGnal Demo Seeder',
      authorType: 'system',
    });

    const post = upsertDemoForumPost({
      id: input.forumPostId,
      author: input.reporter,
      content: input.message,
      createdAt: new Date(Date.now() - (index + 1) * 90_000).toISOString(),
      verified: false,
      aiFlag: false,
      likes: input.likes,
      dislikes: 0,
      reports: 0,
      moderationState: 'live',
      replies: [],
      images: [],
      category: 'Weather',
      crisisTag: 'Boon Lay Flooding',
      topicTag: 'boon-lay-flooding',
      location: input.location,
      latitude: input.latitude,
      longitude: input.longitude,
      sourceReportId: ticket.id,
      similarReports: Math.max(0, input.likes - 3),
    });

    createdReports.push(ticket);
    forumPostIds.push(post.id);
  }

  if (createdReports[0]) {
    await pingTicketAgencies(createdReports[0].id, ['LTA']);
  }

  return { createdReports, forumPostIds };
}

export async function clearExistingBoonLayFloodDemo() {
  clearDemoForumPosts(demoForumPostIds);
  clearForumPostsMatching((post) => {
    const text = `${post.content} ${post.crisisTag ?? ''} ${post.topicTag ?? ''} ${post.location ?? ''}`.toLowerCase();
    return text.includes('boon lay') || text.includes('boon-lay-flooding');
  });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `
        DELETE FROM citizen.reports
        WHERE title = 'Boon Lay Flooding'
           OR report_type = 'Boon Lay Flooding'
           OR location_text ILIKE '%Boon Lay%'
           OR description ILIKE '%Boon Lay%'
           OR EXISTS (
          SELECT 1
          FROM citizen.report_comments comments
          WHERE comments.report_id = citizen.reports.id
            AND comments.body ILIKE $1
           )
      `,
      [`%${demoMarker}%`],
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

export async function countBoonLayFloodReports() {
  const rows = await query<{ count: string }>(
    `
      SELECT count(*)::text AS count
      FROM citizen.reports
      WHERE title = 'Boon Lay Flooding'
         OR EXISTS (
          SELECT 1
          FROM citizen.report_comments comments
          WHERE comments.report_id = citizen.reports.id
            AND comments.body ILIKE $1
         )
         OR location_text ILIKE '%Boon Lay%'
    `,
    [`%${demoMarker}%`],
  );
  return Number(rows[0]?.count ?? 0);
}
