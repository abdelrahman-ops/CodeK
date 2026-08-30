import React from 'react';
import ReactMarkdown from 'react-markdown';
import { cn } from '../../lib/utils.js';

interface ContentViewerProps {
  content: string;
  className?: string;
}

export function MarkdownViewer({ content, className }: ContentViewerProps) {
  if (!content) return null;

  // If content contains HTML tags from TipTap editor, render as sanitized HTML
  const isHtml = /<[a-z][\s\S]*>/i.test(content);

  if (isHtml) {
    return (
      <div
        className={cn(
          'prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed break-words',
          className
        )}
        dangerouslySetInnerHTML={{ __html: content }}
      />
    );
  }

  return (
    <div
      className={cn(
        'prose prose-slate dark:prose-invert max-w-none text-slate-800 dark:text-slate-200 leading-relaxed break-words',
        className
      )}
    >
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100 mt-6 mb-4 border-b border-slate-200/60 dark:border-slate-800 pb-2">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mt-6 mb-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200 mt-4 mb-2">
              {children}
            </h3>
          ),
          p: ({ children }) => (
            <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 my-3 leading-relaxed">
              {children}
            </p>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside space-y-1.5 my-3 text-slate-700 dark:text-slate-300 text-sm sm:text-base">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside space-y-1.5 my-3 text-slate-700 dark:text-slate-300 text-sm sm:text-base">
              {children}
            </ol>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-s-4 border-brand-500 bg-brand-50/50 dark:bg-brand-950/30 p-4 rounded-e-xl my-4 text-slate-700 dark:text-slate-300 italic">
              {children}
            </blockquote>
          ),
          code({ className: codeClass, children, ...props }) {
            const isInline = !codeClass && typeof children === 'string' && !children.includes('\n');
            if (isInline) {
              return (
                <code
                  className="px-1.5 py-0.5 rounded-md font-mono text-xs sm:text-sm bg-slate-100 dark:bg-slate-800 text-brand-600 dark:text-brand-400 font-semibold border border-slate-200/60 dark:border-slate-700/60"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <div className="relative my-4 rounded-2xl overflow-hidden border border-slate-800 bg-slate-950 text-slate-100 shadow-lg">
                <div className="flex items-center justify-between px-4 py-2 bg-slate-900 border-b border-slate-800 text-xs font-mono text-slate-400 select-none">
                  <span>Source Code</span>
                </div>
                <pre className="p-4 text-xs sm:text-sm font-mono overflow-x-auto leading-relaxed">
                  <code>{children}</code>
                </pre>
              </div>
            );
          }
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
