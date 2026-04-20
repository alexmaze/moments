/**
 * 话题标签解析工具
 * 
 * 规则（参考微博）：
 * - 以 # 开头（前面不能是单词字符，避免匹配 URL）
 * - 支持 Unicode 字母、数字、下划线
 * - 长度 1-50 字符
 * - 以空白符或非标签字符结束
 * - 必须包含至少一个字母（不能纯数字）
 * - 不区分大小写（存储时标准化为小写）
 */

/**
 * 话题标签解析正则表达式
 */
const HASHTAG_REGEX = /\B#([\p{L}\p{N}_]{1,50})(?=\s|$|[^\p{L}\p{N}_])/gu;

/**
 * 从文本中解析话题标签
 * @param text 原始文本
 * @returns 标签数组（去重后，保留首次出现的大小写）
 * 
 * @example
 * parseHashtags('#JavaScript #javascript') // ['JavaScript']
 * parseHashtags('今天#天气真好') // ['天气真好']
 * parseHashtags('#话题。结束') // ['话题']
 * parseHashtags('#123') // [] (纯数字无效)
 */
export function parseHashtags(text: string): string[] {
  if (!text) return [];
  
  const matches = [...text.matchAll(HASHTAG_REGEX)];
  const seen = new Set<string>();
  
  return matches
    .map(m => m[1].replace(/[\p{P}]+$/u, ''))  // 移除末尾可能残留的标点
    .filter(tag => /[\p{L}]/u.test(tag))       // 必须包含至少一个字母
    .filter(tag => {
      const lower = tag.toLowerCase();
      if (seen.has(lower)) return false;
      seen.add(lower);
      return true;
    });
}

/**
 * 标签标准化（用于存储和查询）
 * @param tag 原始标签
 * @returns 小写标准化后的标签
 */
export function normalizeHashtag(tag: string): string {
  return tag.toLowerCase().trim();
}

/**
 * 验证标签是否有效
 * @param tag 标签名（不含 #）
 * @returns 是否有效
 */
export function isValidHashtag(tag: string): boolean {
  if (!tag || tag.length > 50) return false;
  if (!/^[\p{L}\p{N}_]+$/u.test(tag)) return false;
  if (!/[\p{L}]/u.test(tag)) return false;  // 必须含字母
  return true;
}

/**
 * 将文本中的标签转换为可渲染的结构
 * @param content 原始文本
 * @returns 渲染片段数组
 * 
 * @example
 * renderContentWithTags('#你好 世界')
 * // [{ type: 'tag', value: '你好' }, { type: 'text', value: ' 世界' }]
 */
export function renderContentWithTags(content: string): Array<{ type: 'tag' | 'text'; value: string }> {
  if (!content) return [];
  
  const result: Array<{ type: 'tag' | 'text'; value: string }> = [];
  let lastIndex = 0;
  
  const regex = /\B#[\p{L}\p{N}_]{1,50}(?=\s|$|[^\p{L}\p{N}_])/gu;
  let match: RegExpExecArray | null;
  
  while ((match = regex.exec(content)) !== null) {
    // 添加标签前的文本
    if (match.index > lastIndex) {
      result.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    
    // 提取标签名（移除 # 前缀和末尾标点）
    let tagName = match[0].slice(1);
    tagName = tagName.replace(/[\p{P}]+$/u, '');
    
    if (/[\p{L}]/u.test(tagName)) {
      result.push({ type: 'tag', value: tagName });
    } else {
      // 无效标签（纯数字），当作普通文本
      result.push({ type: 'text', value: match[0] });
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // 添加剩余文本
  if (lastIndex < content.length) {
    result.push({ type: 'text', value: content.slice(lastIndex) });
  }
  
  return result;
}