const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';

const MENTION_REGEX = new RegExp(
  `@\\{(.+)\\|(${UUID_PATTERN})\\}`,
  'gi',
);

export interface ParsedMention {
  displayName: string;
  userId: string;
}

export function parseMentions(text: string): ParsedMention[] {
  if (!text) return [];

  const matches = [...text.matchAll(MENTION_REGEX)];
  const seen = new Set<string>();

  return matches
    .map((m) => ({
      displayName: m[1],
      userId: m[2],
    }))
    .filter((mention) => {
      if (seen.has(mention.userId)) return false;
      seen.add(mention.userId);
      return true;
    });
}

export type ContentSegment =
  | { type: 'text'; value: string }
  | { type: 'tag'; value: string }
  | { type: 'mention'; displayName: string; userId: string; raw: string };

const HASHTAG_REGEX = /\B#[\p{L}\p{N}_]{1,50}(?=\s|$|[^\p{L}\p{N}_])/gu;

export function renderContentWithTagsAndMentions(content: string): ContentSegment[] {
  if (!content) return [];

  const result: ContentSegment[] = [];
  let lastIndex = 0;

  const combinedRegex = new RegExp(
    `${HASHTAG_REGEX.source}|${MENTION_REGEX.source}`,
    'giu',
  );

  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }

    if (match[0].startsWith('#')) {
      let tagName = match[0].slice(1);
      tagName = tagName.replace(/[\p{P}]+$/u, '');
      if (/[\p{L}]/u.test(tagName)) {
        result.push({ type: 'tag', value: tagName });
      } else {
        result.push({ type: 'text', value: match[0] });
      }
    } else if (match[0].startsWith('@{')) {
      result.push({
        type: 'mention',
        displayName: match[1],
        userId: match[2],
        raw: match[0],
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    result.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return result;
}
