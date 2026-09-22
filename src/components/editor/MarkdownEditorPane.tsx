import React, { useRef, useState } from "react";
import {
  Bold,
  Italic,
  Code,
  Heading2,
  Heading3,
  Link,
  Image,
  List,
  ListOrdered,
  Quote,
  Minus,
  Table,
  ChevronDown,
  Terminal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { ImagePickerDialog } from "./ImagePickerDialog";

type Props = {
  content: string;
  onChange: (value: string) => void;
  postSlug: string;
};

const ACCORDION_TEMPLATE = `:::debug-accordion
::item Section Title
Content goes here.

::item Another Section
More content here.
:::`;

const TABLE_TEMPLATE = `| Column 1 | Column 2 | Column 3 |
| -------- | -------- | -------- |
| Cell 1   | Cell 2   | Cell 3   |
| Cell 4   | Cell 5   | Cell 6   |`;

export function MarkdownEditorPane({ content, onChange, postSlug }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);

  const insert = (
    before: string,
    after = "",
    defaultText = "text",
    opts: { newline?: boolean } = {},
  ) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const selected = value.slice(start, end) || defaultText;
    const prefix = opts.newline && start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    const newValue = value.slice(0, start) + prefix + before + selected + after + value.slice(end);
    onChange(newValue);
    const newCursor = start + prefix.length + before.length + selected.length;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCursor, newCursor);
    });
  };

  const insertRaw = (text: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, value } = ta;
    const prefix = start > 0 && value[start - 1] !== "\n" ? "\n" : "";
    const newValue = value.slice(0, start) + prefix + text + "\n" + value.slice(start);
    onChange(newValue);
    const newCursor = start + prefix.length + text.length + 1;
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(newCursor, newCursor);
    });
  };

  const prefixLines = (prefix: string) => {
    const ta = textareaRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value } = ta;
    const lines = value.slice(start, end || start).split("\n");
    const prefixed = lines.map((l) => prefix + l).join("\n");
    const newValue = value.slice(0, start) + prefixed + value.slice(end || start);
    onChange(newValue);
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(start, start + prefixed.length);
    });
  };

  const ToolBtn = ({
    icon: Icon,
    label,
    onClick,
  }: {
    icon: React.ElementType;
    label: string;
    onClick: () => void;
  }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onMouseDown={(e) => {
            e.preventDefault(); // keep textarea focus
            onClick();
          }}
        >
          <Icon className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        {label}
      </TooltipContent>
    </Tooltip>
  );

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-secondary/40 px-2 py-1.5">
        <ToolBtn icon={Heading2} label="Heading 2" onClick={() => prefixLines("## ")} />
        <ToolBtn icon={Heading3} label="Heading 3" onClick={() => prefixLines("### ")} />

        <div className="mx-1 h-4 w-px bg-border" />

        <ToolBtn icon={Bold} label="Bold (Ctrl+B)" onClick={() => insert("**", "**", "bold text")} />
        <ToolBtn icon={Italic} label="Italic (Ctrl+I)" onClick={() => insert("_", "_", "italic text")} />
        <ToolBtn icon={Code} label="Inline code" onClick={() => insert("`", "`", "code")} />
        <ToolBtn
          icon={Terminal}
          label="Code block"
          onClick={() => insertRaw("```\ncode here\n```")}
        />

        <div className="mx-1 h-4 w-px bg-border" />

        <ToolBtn icon={List} label="Bullet list" onClick={() => prefixLines("- ")} />
        <ToolBtn icon={ListOrdered} label="Ordered list" onClick={() => prefixLines("1. ")} />
        <ToolBtn icon={Quote} label="Blockquote" onClick={() => prefixLines("> ")} />

        <div className="mx-1 h-4 w-px bg-border" />

        <ToolBtn
          icon={Link}
          label="Link"
          onClick={() => insert("[", "](url)", "link text")}
        />
        <ToolBtn
          icon={Image}
          label="Insert image"
          onClick={() => setImageDialogOpen(true)}
        />
        <ToolBtn
          icon={Table}
          label="Table"
          onClick={() => insertRaw(TABLE_TEMPLATE)}
        />
        <ToolBtn
          icon={Minus}
          label="Horizontal rule"
          onClick={() => insertRaw("---")}
        />
        <ToolBtn
          icon={ChevronDown}
          label="Accordion block"
          onClick={() => insertRaw(ACCORDION_TEMPLATE)}
        />
      </div>

      {/* Editor */}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        className="flex-1 resize-none bg-background p-4 font-mono text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground/50"
        placeholder="Write your post content in Markdown…

## Section heading

Paragraph text with **bold** and _italic_.

```bash
# code block
echo hello
```

:::debug-accordion
::item Expandable section
Content here.
:::
"
      />

      <ImagePickerDialog
        open={imageDialogOpen}
        postSlug={postSlug}
        onClose={() => setImageDialogOpen(false)}
        onInsert={(md) => insertRaw(md)}
      />
    </div>
  );
}
