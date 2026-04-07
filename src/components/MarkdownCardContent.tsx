"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";

export function MarkdownCardContent({
  content,
  format = "plain",
}: {
  content: string;
  format?: "plain" | "markdown";
}) {
  if (format === "plain") {
    return <p className="whitespace-pre-wrap break-words">{content}</p>;
  }

  return (
    <div className="prose prose-sm max-w-none dark:prose-invert break-words [&_pre]:bg-surface-base [&_pre]:border [&_pre]:border-border [&_pre]:rounded-lg [&_pre]:p-3 [&_code]:text-xs [&_code]:bg-surface-base [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_table]:text-sm">
      <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
