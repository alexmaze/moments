import { useEffect, useCallback, forwardRef, useImperativeHandle } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getSelection, $createTextNode, COMMAND_PRIORITY_HIGH, KEY_DOWN_COMMAND, $getRoot, $createParagraphNode } from 'lexical';
import {
  BeautifulMentionsPlugin,
  BeautifulMentionNode,
  $createBeautifulMentionNode,
  type BeautifulMentionsItem,
  type BeautifulMentionsMenuProps,
  type BeautifulMentionsMenuItemProps,
} from 'lexical-beautiful-mentions';
import { $convertFromStorageFormat, $convertToStorageFormat } from './serialization';
import { searchUsersApi } from '@/api/users.api';
import { getTagsApi } from '@/api/tags.api';
import { Loader2, User } from 'lucide-react';

export interface RichTextEditorRef {
  focus: () => void;
  getSerializedContent: () => string;
  insertText: (text: string) => void;
  insertMention: (displayName: string, userId: string) => void;
  clear: () => void;
  setSerializedContent: (value: string) => void;
}

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  contentClassName?: string;
  placeholderClassName?: string;
  minRows?: number;
  onKeyDown?: (e: React.KeyboardEvent) => boolean | void;
}

const editorTheme = {
  beautifulMentions: {
    '@': 'text-primary font-medium bg-primary/10 rounded px-0.5',
    '@Focused': 'text-primary font-medium bg-primary/20 rounded px-0.5 outline-none',
    '#': 'text-primary font-medium bg-primary/10 rounded px-0.5',
    '#Focused': 'text-primary font-medium bg-primary/20 rounded px-0.5 outline-none',
  },
};

function onError(error: Error) {
  console.error('[RichTextEditor]', error);
}

function OnChangePluginInner({ onChange }: { onChange: (value: string) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const serialized = $convertToStorageFormat();
        onChange(serialized);
      });
    });
  }, [editor, onChange]);

  return null;
}

function KeyDownPlugin({ onKeyDown }: { onKeyDown?: (e: React.KeyboardEvent) => boolean | void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    if (!onKeyDown) return;

    return editor.registerCommand(
      KEY_DOWN_COMMAND,
      (event: KeyboardEvent) => {
        const result = onKeyDown(event as unknown as React.KeyboardEvent);
        return result === true;
      },
      COMMAND_PRIORITY_HIGH,
    );
  }, [editor, onKeyDown]);

  return null;
}

function InsertMentionPlugin({ ref }: { ref: React.Ref<RichTextEditorRef> }) {
  const [editor] = useLexicalComposerContext();

  useImperativeHandle(ref, () => ({
    focus: () => editor.focus(),
    getSerializedContent: () => {
      let result = '';
      editor.getEditorState().read(() => {
        result = $convertToStorageFormat();
      });
      return result;
    },
    insertText: (text: string) => {
      editor.focus();
      editor.update(() => {
        const selection = $getSelection();
        if (selection) {
          selection.insertText(text);
        }
      });
    },
    insertMention: (displayName: string, userId: string) => {
      editor.update(() => {
        const selection = $getSelection();
        const mentionNode = $createBeautifulMentionNode('@', displayName, { id: userId });
        if (selection) {
          selection.insertNodes([mentionNode, $createTextNode(' ')]);
        }
      });
    },
    clear: () => {
      editor.update(() => {
        $getRoot().clear();
        $getRoot().append($createParagraphNode());
      });
    },
    setSerializedContent: (value: string) => {
      editor.update(() => {
        const root = $getRoot();
        root.clear();

        const paragraph = $createParagraphNode();
        const nodes = $convertFromStorageFormat(value);
        if (nodes.length === 0) {
          root.append(paragraph);
          return;
        }

        paragraph.append(...nodes);
        root.append(paragraph);
      });
    },
  }), [editor]);

  return null;
}

function DynamicMentionsPlugin() {
  const handleSearch = useCallback(async (trigger: string, query?: string | null): Promise<BeautifulMentionsItem[]> => {
    if (trigger === '@') {
      if (!query) return [];
      const users = await searchUsersApi(query, 10);
      return users.map(u => ({
        value: u.displayName,
        id: u.id,
        avatarUrl: u.avatarUrl,
      }));
    }
    if (trigger === '#') {
      if (!query) return [];
      const { data: tags } = await getTagsApi(query, 10);
      return tags.map(t => ({ value: t.name }));
    }
    return [];
  }, []);

  return (
    <BeautifulMentionsPlugin
      triggers={['@', '#']}
      onSearch={handleSearch}
      creatable={{ '@': false, '#': true }}
      menuComponent={MenuComponent}
      menuItemComponent={MenuItemComponent}
      autoSpace={true}
    />
  );
}

function MenuComponent(props: BeautifulMentionsMenuProps) {
  const { loading, children, ...rest } = props;
  return (
    <ul
      className="absolute z-50 surface-overlay border border-border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto min-w-[200px]"
      {...rest}
    >
      {loading ? (
        <li className="px-3 py-2 text-sm text-muted-foreground flex items-center justify-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>搜索中...</span>
        </li>
      ) : (
        children
      )}
    </ul>
  );
}

const MenuItemComponent = forwardRef<HTMLLIElement, BeautifulMentionsMenuItemProps>(
  ({ selected, item, ...props }, ref) => {
    const avatarUrl = item.data?.avatarUrl as string | null | undefined;
    const isMention = item.trigger === '@';

    return (
      <li
        ref={ref}
        className={`px-3 py-1.5 text-sm cursor-pointer flex items-center gap-2 ${
          selected ? 'bg-accent text-accent-foreground' : 'text-foreground'
        }`}
        {...props}
      >
        {isMention && (
          avatarUrl ? (
            <img
              src={avatarUrl}
              alt=""
              className="w-5 h-5 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center shrink-0">
              <User className="w-3 h-3 text-muted-foreground" />
            </div>
          )
        )}
        <span>{item.displayValue || item.value}</span>
      </li>
    );
  },
);

export const RichTextEditor = forwardRef<RichTextEditorRef, RichTextEditorProps>(
  function RichTextEditor(
    {
      onChange,
      placeholder,
      className = '',
      contentClassName = '',
      placeholderClassName = '',
      minRows = 3,
      onKeyDown,
    },
    ref,
  ) {
    // lineHeight-6 (1.5rem) + py-2 (1rem total)
    const minHeight = minRows * 1.5 + 1.0;

    const initialConfig = {
      namespace: 'MomentsEditor',
      theme: editorTheme,
      nodes: [BeautifulMentionNode],
      onError,
    };

    const handleChange = useCallback(
      (newState: string) => {
        onChange(newState);
      },
      [onChange],
    );

    return (
      <LexicalComposer initialConfig={initialConfig}>
        <div className={`relative ${className}`} style={{ minHeight: `${minHeight}rem` }}>
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                 className={`w-full text-sm leading-6 whitespace-pre-wrap break-words bg-transparent resize-none focus:outline-none min-h-[inherit] px-3 py-2 ${contentClassName}`}
                 style={{ caretColor: 'hsl(var(--primary))' }}
                 aria-placeholder={placeholder || ''}
                 placeholder={
                   <div
                     className={`absolute inset-0 text-sm leading-6 text-muted-foreground pointer-events-none px-3 py-2 ${placeholderClassName}`}
                   >
                     {placeholder}
                   </div>
                 }
               />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <OnChangePluginInner onChange={handleChange} />
          <KeyDownPlugin onKeyDown={onKeyDown} />
          <InsertMentionPlugin ref={ref} />
          <DynamicMentionsPlugin />
        </div>
      </LexicalComposer>
    );
  },
);
