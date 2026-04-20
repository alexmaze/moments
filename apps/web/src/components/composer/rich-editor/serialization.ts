/**
 * 存储格式 ↔ Lexical 节点
 * 存储: @{displayName|userId}  /  #tagName
 * 节点: BeautifulMentionNode { trigger, value, data: { id } }
 */

import { $getRoot, type LexicalNode, TextNode } from 'lexical';
import {
  $createBeautifulMentionNode,
  $isBeautifulMentionNode,
  type BeautifulMentionNode,
} from 'lexical-beautiful-mentions';

const MENTION_PATTERN = '@\\{([^|]+)\\|([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\\}';
const HASHTAG_PATTERN = '#([\\p{L}\\p{N}_]+)';

interface ParsedMention {
  type: 'mention';
  displayName: string;
  userId: string;
}

interface ParsedHashtag {
  type: 'hashtag';
  name: string;
}

interface ParsedText {
  type: 'text';
  value: string;
}

type ParsedSegment = ParsedMention | ParsedHashtag | ParsedText;

export function parseStorageFormat(content: string): ParsedSegment[] {
  if (!content) return [];

  const result: ParsedSegment[] = [];
  const combinedRegex = new RegExp(
    `${MENTION_PATTERN}|${HASHTAG_PATTERN}`,
    'giu'
  );

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = combinedRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }

    if (match[0].startsWith('@{')) {
      result.push({
        type: 'mention',
        displayName: match[1],
        userId: match[2],
      });
    } else if (match[0].startsWith('#')) {
      result.push({ type: 'hashtag', name: match[3] });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    result.push({ type: 'text', value: content.slice(lastIndex) });
  }

  return result;
}

/**
 * 将存储格式转换为 Lexical 节点数组
 * 用于初始化编辑器内容
 */
export function $convertFromStorageFormat(content: string): LexicalNode[] {
  const segments = parseStorageFormat(content);
  const nodes: LexicalNode[] = [];

  for (const segment of segments) {
    if (segment.type === 'text') {
      nodes.push(new TextNode(segment.value || ''));
    } else if (segment.type === 'mention') {
      nodes.push(
        $createBeautifulMentionNode('@', segment.displayName, { id: segment.userId })
      );
    } else if (segment.type === 'hashtag') {
      nodes.push($createBeautifulMentionNode('#', segment.name));
    }
  }

  return nodes;
}

/**
 * 将 Lexical 编辑器状态转换为存储格式
 * 用于提交到 API
 */
export function $convertToStorageFormat(): string {
  const root = $getRoot();
  const paragraphs: string[] = [];

  for (const paragraph of root.getChildren()) {
    let text = '';
    for (const node of (paragraph as unknown as { getChildren: () => LexicalNode[] }).getChildren()) {
      if ($isBeautifulMentionNode(node)) {
        const trigger = (node as BeautifulMentionNode).getTrigger();
        const value = (node as BeautifulMentionNode).getValue();
        const data = (node as BeautifulMentionNode).getData();

        if (trigger === '@' && data?.id) {
          text += `@{${value}|${data.id}}`;
        } else if (trigger === '#') {
          text += `#${value}`;
        } else {
          text += `${trigger}${value}`;
        }
      } else if (node instanceof TextNode) {
        text += node.getTextContent();
      }
    }
    paragraphs.push(text);
  }

  return paragraphs.join('\n').trimEnd();
}
