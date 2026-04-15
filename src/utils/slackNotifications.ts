import https from "https";

const POLL_INTERVAL_MS = 10_000;

export interface SlackNotification {
  channelId: string;
  channelName: string;
  isDm: boolean;
  latestTs: string;
}

export interface SlackStats {
  totalCount: number;           // total mention/notification count
  notifications: SlackNotification[]; // sorted newest first
  error?: string;
}

let cachedStats: SlackStats = { totalCount: 0, notifications: [] };
let pollingTimer: ReturnType<typeof setInterval> | null = null;
let refCount = 0;
let currentToken = "";

// Navigation cursor: index into notifications array
let navIndex = 0;

export function startSlackPolling(token: string): void {
  currentToken = token;
  refCount++;
  if (pollingTimer !== null) return;
  fetchStats().catch(() => {});
  pollingTimer = setInterval(() => fetchStats().catch(() => {}), POLL_INTERVAL_MS);
}

export function stopSlackPolling(): void {
  refCount = Math.max(0, refCount - 1);
  if (refCount > 0) return;
  if (pollingTimer !== null) {
    clearInterval(pollingTimer);
    pollingTimer = null;
  }
}

export function getSlackStats(): SlackStats {
  return cachedStats;
}

/**
 * Returns the next unread notification to navigate to (cycling through list).
 * Returns null if no unread notifications exist.
 */
export function getNextNotification(): SlackNotification | null {
  const { notifications } = cachedStats;
  if (notifications.length === 0) return null;

  // Clamp navIndex
  if (navIndex >= notifications.length) navIndex = 0;
  const next = notifications[navIndex];
  navIndex = (navIndex + 1) % notifications.length;
  return next;
}

async function fetchStats(): Promise<void> {
  if (!currentToken) return;

  try {
    // Try users.counts first (unofficial but works with user tokens, gives exact mention counts)
    const counts = await slackGet("users.counts");

    if (counts.ok) {
      let totalMentions = 0;
      const notifications: SlackNotification[] = [];

      // channels: array with id, name, mention_count, unread_count, latest
      const channels = (counts.channels as ChannelCount[]) ?? [];
      const ims = (counts.ims as ImCount[]) ?? [];
      const mpims = (counts.mpims as ImCount[]) ?? [];

      for (const ch of channels) {
        if ((ch.mention_count ?? 0) > 0) {
          totalMentions += ch.mention_count;
          notifications.push({
            channelId: ch.id,
            channelName: ch.name ?? ch.id,
            isDm: false,
            latestTs: ch.latest ?? "0",
          });
        }
      }

      for (const im of [...ims, ...mpims]) {
        if ((im.dm_count ?? 0) > 0) {
          totalMentions += im.dm_count;
          notifications.push({
            channelId: im.id,
            channelName: im.user_id ?? im.id,
            isDm: true,
            latestTs: im.latest ?? "0",
          });
        }
      }

      notifications.sort((a, b) => parseFloat(b.latestTs) - parseFloat(a.latestTs));

      const prev = cachedStats.notifications;
      if (notifications.length !== prev.length || notifications.some((n, i) => n.channelId !== prev[i].channelId)) {
        navIndex = 0;
      }

      cachedStats = { totalCount: totalMentions, notifications };
      return;
    }

    // Fallback: conversations.list (less accurate but always available)
    await fetchViaConversations();
  } catch (err) {
    cachedStats = { ...cachedStats, error: String(err) };
  }
}

async function fetchViaConversations(): Promise<void> {
  const types = "public_channel,private_channel,mpim,im";
  const channels: ConvChannel[] = [];
  let cursor = "";

  do {
    const params = new URLSearchParams({
      exclude_archived: "true",
      limit: "200",
      types,
      ...(cursor ? { cursor } : {}),
    });

    const data = await slackGet(`conversations.list?${params}`);
    if (!data.ok) break;

    channels.push(...((data.channels as ConvChannel[]) ?? []));
    const meta = data.response_metadata as { next_cursor?: string } | undefined;
    cursor = meta?.next_cursor ?? "";
  } while (cursor);

  const notifications: SlackNotification[] = [];
  let total = 0;

  for (const ch of channels) {
    const unread = ch.unread_count_display ?? 0;
    if (unread > 0) {
      total += unread;
      notifications.push({
        channelId: ch.id,
        channelName: ch.name ?? ch.id,
        isDm: ch.is_im ?? false,
        latestTs: ch.latest?.ts ?? "0",
      });
    }
  }

  notifications.sort((a, b) => parseFloat(b.latestTs) - parseFloat(a.latestTs));
  cachedStats = { totalCount: total, notifications };
}

// Type helpers
interface ChannelCount {
  id: string;
  name?: string;
  mention_count: number;
  unread_count?: number;
  latest?: string;
}

interface ImCount {
  id: string;
  user_id?: string;
  dm_count: number;
  latest?: string;
}

interface ConvChannel {
  id: string;
  name?: string;
  is_im?: boolean;
  unread_count_display?: number;
  latest?: { ts: string };
}

function slackGet(path: string): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "slack.com",
        path: `/api/${path}`,
        method: "GET",
        headers: {
          Authorization: `Bearer ${currentToken}`,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk: Buffer) => (body += chunk.toString()));
        res.on("end", () => {
          try {
            resolve(JSON.parse(body) as Record<string, unknown>);
          } catch {
            reject(new Error("JSON parse error"));
          }
        });
      }
    );

    req.on("error", reject);
    req.setTimeout(8000, () => {
      req.destroy();
      reject(new Error("timeout"));
    });
    req.end();
  });
}
