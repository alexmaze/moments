import { useState, useCallback, useEffect } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useTags } from './useTags';
import type { TagDto } from '@/api/tags.api';

interface TagSuggestionState {
  isOpen: boolean;
  query: string;
  startIndex: number;
  selectedIndex: number;
  suggestions: TagDto[];
}

interface UseTagSuggestionReturn {
  isOpen: boolean;
  query: string;
  selectedIndex: number;
  suggestions: TagDto[];
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  selectTag: (tag: TagDto) => void;
  close: () => void;
  getCaretCoordinates: () => { top: number; left: number } | null;
}

const HASHTAG_TRIGGER_REGEX = /#([\p{L}\p{N}_]*)$/u;

export function useTagSuggestion(
  content: string,
  setContent: (content: string) => void,
  textareaRef: React.RefObject<HTMLTextAreaElement | null>,
): UseTagSuggestionReturn {
  const [state, setState] = useState<TagSuggestionState>({
    isOpen: false,
    query: '',
    startIndex: 0,
    selectedIndex: 0,
    suggestions: [],
  });

  const { data: tagsData } = useTags(state.query, 10);

  const debouncedUpdateQuery = useDebouncedCallback((query: string) => {
    if (query.length >= 1) {
      setState(prev => ({
        ...prev,
        isOpen: true,
        query,
        selectedIndex: 0,
      }));
    }
  }, 150);

  useEffect(() => {
    if (state.isOpen && tagsData?.data) {
      setState(prev => ({
        ...prev,
        suggestions: tagsData.data,
      }));
    }
  }, [state.isOpen, tagsData]);

  useEffect(() => {
    if (!textareaRef.current) return;

    const textarea = textareaRef.current;
    const value = textarea.value;
    const caretPos = textarea.selectionStart;

    const textBeforeCaret = value.slice(0, caretPos);
    const match = textBeforeCaret.match(HASHTAG_TRIGGER_REGEX);

    if (match) {
      const query = match[1];
      const startIndex = match.index!;

      if (query.length >= 1 && query !== state.query) {
        debouncedUpdateQuery(query);
        setState(prev => ({
          ...prev,
          startIndex,
          query,
        }));
      } else if (query.length === 0) {
        setState(prev => ({
          ...prev,
          isOpen: false,
          query: '',
          startIndex: 0,
          suggestions: [],
        }));
      }
    } else {
      if (state.isOpen) {
        setState(prev => ({
          ...prev,
          isOpen: false,
          query: '',
          startIndex: 0,
          suggestions: [],
        }));
      }
    }
  }, [content, textareaRef, state.isOpen, state.query, debouncedUpdateQuery]);

  const getCaretCoordinates = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return null;

    const rect = textarea.getBoundingClientRect();
    const computed = window.getComputedStyle(textarea);

    const lineHeight = parseFloat(computed.lineHeight) || 20;
    const paddingTop = parseFloat(computed.paddingTop) || 0;
    const paddingLeft = parseFloat(computed.paddingLeft) || 0;
    const borderTop = parseFloat(computed.borderTopWidth) || 0;
    const borderLeft = parseFloat(computed.borderLeftWidth) || 0;

    const caretPos = textarea.selectionStart;
    const text = textarea.value.substring(0, caretPos);
    const lines = text.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentLineText = lines[currentLineIndex];

    const mirror = document.createElement('div');
    mirror.style.cssText = `
      position: fixed;
      top: -9999px;
      left: -9999px;
      white-space: pre;
      font-size: ${computed.fontSize};
      font-family: ${computed.fontFamily};
      line-height: ${computed.lineHeight};
      padding: 0;
      margin: 0;
      border: 0;
      box-sizing: border-box;
    `;
    document.body.appendChild(mirror);

    let xOffset = 0;
    if (currentLineText.length > 0) {
      mirror.textContent = currentLineText;
      xOffset = mirror.offsetWidth;
    }

    document.body.removeChild(mirror);

    const top = rect.top + borderTop + paddingTop + (currentLineIndex + 1) * lineHeight;
    const left = rect.left + borderLeft + paddingLeft + xOffset;

    return { top, left };
  }, [textareaRef]);

  const selectTag = useCallback((tag: TagDto) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const value = textarea.value;
    const caretPos = textarea.selectionStart;
    const textBeforeCaret = value.slice(0, caretPos);
    const match = textBeforeCaret.match(HASHTAG_TRIGGER_REGEX);

    if (!match) return;

    const startIndex = match.index!;
    const afterInsert = value.slice(0, startIndex) + '#' + tag.name + ' ' + value.slice(caretPos);
    setContent(afterInsert);

    const newCaretPos = startIndex + tag.name.length + 2;
    setTimeout(() => {
      textarea.setSelectionRange(newCaretPos, newCaretPos);
      textarea.focus();
    }, 0);

    setState(prev => ({
      ...prev,
      isOpen: false,
      query: '',
      startIndex: 0,
      selectedIndex: 0,
      suggestions: [],
    }));
  }, [textareaRef, setContent]);

  const onKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!state.isOpen || state.suggestions.length === 0) return false;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setState(prev => ({
        ...prev,
        selectedIndex: Math.min(prev.selectedIndex + 1, prev.suggestions.length - 1),
      }));
      return true;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setState(prev => ({
        ...prev,
        selectedIndex: Math.max(prev.selectedIndex - 1, 0),
      }));
      return true;
    }

    if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      const selected = state.suggestions[state.selectedIndex];
      if (selected) {
        selectTag(selected);
      }
      return true;
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      setState(prev => ({
        ...prev,
        isOpen: false,
        query: '',
        startIndex: 0,
        selectedIndex: 0,
        suggestions: [],
      }));
      return true;
    }

    return false;
  }, [state.isOpen, state.suggestions, state.selectedIndex, selectTag]);

  const close = useCallback(() => {
    setState(prev => ({
      ...prev,
      isOpen: false,
      query: '',
      startIndex: 0,
      selectedIndex: 0,
      suggestions: [],
    }));
  }, []);

  return {
    isOpen: state.isOpen,
    query: state.query,
    selectedIndex: state.selectedIndex,
    suggestions: state.suggestions,
    onKeyDown,
    selectTag,
    close,
    getCaretCoordinates,
  };
}