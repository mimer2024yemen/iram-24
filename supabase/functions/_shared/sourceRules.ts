export function sourceFetchUrl(source: { feed_url?: string | null; url: string }): string {
  return (source.feed_url?.trim() || source.url.trim());
}

export function activeSourceFilter(sourceId?: string) {
  return sourceId ? { is_active: true, id: sourceId } : { is_active: true };
}

export function validPublishedAt(value: string, now = new Date()): string {
  const date = value ? new Date(value) : now;
  return Number.isFinite(date.getTime()) ? date.toISOString() : now.toISOString();
}