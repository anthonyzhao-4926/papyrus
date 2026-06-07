export function formatAgo(iso: string, now: Date = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86400000);
  if (days <= 0) return "今天更新";
  if (days < 7) return `${days} 天前更新`;
  if (days < 30) return `${Math.floor(days / 7)} 周前更新`;
  return `${Math.floor(days / 30)} 个月前更新`;
}

// icon 既可填 emoji，也可填图片路径（/xxx.svg、http(s) 链接或带图片扩展名）
export function isImageIcon(icon?: string): boolean {
  if (!icon) return false;
  return icon.startsWith("/") || /^https?:\/\//.test(icon) || /\.(svg|png|jpe?g|webp|gif)$/i.test(icon);
}

export function getIsoWeek(date: Date): number {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function excerpt(rawMarkdown: string, max = 120): string {
  if (!rawMarkdown) return "";
  let s = rawMarkdown;
  s = s.replace(/^---\n[\s\S]*?\n---\n?/, "");
  s = s.replace(/^#{1,6}\s+.*$/gm, "");
  s = s.replace(/```[\s\S]*?```/g, "");
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/\*([^*]+)\*/g, "$1");
  s = s.replace(/`([^`]+)`/g, "$1");
  s = s.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");
  s = s.replace(/\s+/g, " ").trim();
  return s.length > max ? s.slice(0, max) + "…" : s;
}

export function countThisMonth(
  articles: Array<{ date: string }>,
  now: Date = new Date(),
): number {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  return articles.filter((a) => {
    const d = new Date(a.date);
    return d.getUTCFullYear() === y && d.getUTCMonth() === m;
  }).length;
}

export interface HeatCell {
  date: string;
  count: number;
  weekday: number;
}

export function buildHeatmap(
  articles: Array<{ date: string }>,
  weeks = 26,
  now: Date = new Date(),
): HeatCell[] {
  const day = now.getUTCDay() || 7;
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - (day - 1));
  const start = new Date(monday);
  start.setUTCDate(start.getUTCDate() - (weeks - 1) * 7);

  const counts = new Map<string, number>();
  for (const a of articles) {
    const d = new Date(a.date);
    const key = d.toISOString().slice(0, 10);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const cells: HeatCell[] = [];
  for (let w = 0; w < weeks; w++) {
    for (let dow = 0; dow < 7; dow++) {
      const cur = new Date(start);
      cur.setUTCDate(cur.getUTCDate() + w * 7 + dow);
      const key = cur.toISOString().slice(0, 10);
      cells.push({ date: key, count: counts.get(key) ?? 0, weekday: dow });
    }
  }
  return cells;
}
