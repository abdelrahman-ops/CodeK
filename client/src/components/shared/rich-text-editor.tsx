import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Heading1,
  Heading2,
  Heading3,
  Pilcrow,
  List,
  ListOrdered,
  Quote,
  Code,
  Link as LinkIcon,
  Undo,
  Redo
} from 'lucide-react';
import { cn } from '../../lib/utils.js';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
  minHeight?: string;
}

export function RichTextEditor({
  content,
  onChange,
  placeholder,
  className,
  minHeight = '240px'
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3]
        }
      }),
      Underline,
      Link.configure({
        openOnClick: false
      })
    ],
    content: content || '<p></p>',
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          'prose prose-slate dark:prose-invert max-w-none focus:outline-none p-4 text-sm leading-relaxed text-slate-800 dark:text-slate-100',
          'min-h-[' + minHeight + ']'
        )
      }
    }
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || '<p></p>');
    }
  }, [content, editor]);

  if (!editor) return null;

  const setLink = () => {
    const previousUrl = editor.getAttributes('link').href;
    const url = window.prompt('URL', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  const toolbarBtn = (
    isActive: boolean,
    onClick: () => void,
    icon: React.ReactNode,
    title: string
  ) => (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'p-1.5 rounded-lg text-slate-600 dark:text-slate-300 transition hover:bg-slate-200 dark:hover:bg-slate-700',
        isActive && 'bg-brand-100 dark:bg-brand-900/60 text-brand-700 dark:text-brand-300 font-bold'
      )}
    >
      {icon}
    </button>
  );

  return (
    <div
      className={cn(
        'w-full rounded-2xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden shadow-sm transition-all focus-within:ring-2 focus-within:ring-brand-500 focus-within:border-brand-500',
        className
      )}
    >
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 p-2 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700/80 select-none">
        {/* Headings */}
        {toolbarBtn(
          editor.isActive('heading', { level: 1 }),
          () => editor.chain().focus().toggleHeading({ level: 1 }).run(),
          <Heading1 className="w-4 h-4" />,
          'Heading 1'
        )}
        {toolbarBtn(
          editor.isActive('heading', { level: 2 }),
          () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
          <Heading2 className="w-4 h-4" />,
          'Heading 2'
        )}
        {toolbarBtn(
          editor.isActive('heading', { level: 3 }),
          () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
          <Heading3 className="w-4 h-4" />,
          'Heading 3'
        )}
        {toolbarBtn(
          editor.isActive('paragraph'),
          () => editor.chain().focus().setParagraph().run(),
          <Pilcrow className="w-4 h-4" />,
          'Paragraph'
        )}

        <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Inline formatting */}
        {toolbarBtn(
          editor.isActive('bold'),
          () => editor.chain().focus().toggleBold().run(),
          <Bold className="w-4 h-4" />,
          'Bold'
        )}
        {toolbarBtn(
          editor.isActive('italic'),
          () => editor.chain().focus().toggleItalic().run(),
          <Italic className="w-4 h-4" />,
          'Italic'
        )}
        {toolbarBtn(
          editor.isActive('underline'),
          () => editor.chain().focus().toggleUnderline().run(),
          <UnderlineIcon className="w-4 h-4" />,
          'Underline'
        )}

        <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1" />

        {/* Lists & Blocks */}
        {toolbarBtn(
          editor.isActive('bulletList'),
          () => editor.chain().focus().toggleBulletList().run(),
          <List className="w-4 h-4" />,
          'Bullet List'
        )}
        {toolbarBtn(
          editor.isActive('orderedList'),
          () => editor.chain().focus().toggleOrderedList().run(),
          <ListOrdered className="w-4 h-4" />,
          'Numbered List'
        )}
        {toolbarBtn(
          editor.isActive('blockquote'),
          () => editor.chain().focus().toggleBlockquote().run(),
          <Quote className="w-4 h-4" />,
          'Blockquote'
        )}
        {toolbarBtn(
          editor.isActive('codeBlock'),
          () => editor.chain().focus().toggleCodeBlock().run(),
          <Code className="w-4 h-4" />,
          'Code Block'
        )}
        {toolbarBtn(
          editor.isActive('link'),
          setLink,
          <LinkIcon className="w-4 h-4" />,
          'Insert Link'
        )}

        <div className="w-[1px] h-4 bg-slate-300 dark:bg-slate-700 mx-1 ms-auto" />

        {/* History */}
        <button
          type="button"
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
          title="Undo"
        >
          <Undo className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40"
          title="Redo"
        >
          <Redo className="w-4 h-4" />
        </button>
      </div>

      {/* Editor Content Area */}
      <div style={{ minHeight }} className="overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
