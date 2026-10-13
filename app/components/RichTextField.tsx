import {useEffect, useState} from "react";
import {EditorContent, useEditor} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";

type Props = {
  label: string;
  name: string;
  value?: string;
  required?: boolean;
};

/**
 * Convert existing HTML or JSON into content that Tiptap understands.
 */
function getInitialContent(value?: string) {
  if (!value || value.trim() === "") {
    return "";
  }

  try {
    return JSON.parse(value);
  } catch {
    // Existing HTML
    return value;
  }
}

/**
 * Safely convert editor content to JSON.
 */
function editorToJson(editor: any) {
  return JSON.stringify(editor.getJSON());
}

/**
 * Toolbar button
 */
function ToolbarButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      style={{
        padding: "6px 10px",
        border: "1px solid #d9d9d9",
        borderRadius: 6,
        background: active ? "#f1f1f1" : "#fff",
        cursor: "pointer",
        fontSize: 13,
      }}
    >
      {children}
    </button>
  );
}

export default function RichTextField({
  label,
  name,
  value,
  required,
}: Props) {
  const [json, setJson] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [2, 3],
        },
      }),

      Link.configure({
        openOnClick: false,
        autolink: true,
        linkOnPaste: true,
      }),

      Placeholder.configure({
        placeholder: "Write description...",
      }),
    ],

    content: getInitialContent(value),

    editorProps: {
      attributes: {
        style: `
          min-height:140px;
          padding:12px;
          border:1px solid #d9d9d9;
          border-radius:8px;
          outline:none;
          font-size:14px;
          line-height:1.6;
          background:#fff;
        `,
      },
    },

    onCreate({editor}) {
      setJson(editorToJson(editor));
    },

    onUpdate({editor}) {
      setJson(editorToJson(editor));
    },
  });

  // Reload editor when value changes
  useEffect(() => {
    if (!editor) return;

    editor.commands.setContent(getInitialContent(value), { emitUpdate: false });
    setJson(editorToJson(editor));
  }, [editor, value]);

  if (!editor) {
    return null;
  }

  return (
    <div style={{display: "flex", flexDirection: "column", gap: 8}}>
      <label
        style={{
          fontWeight: 600,
          fontSize: 14,
        }}
      >
        {label}
      </label>

      <div
  style={{
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 10,
  }}
>
  <ToolbarButton
    active={editor.isActive("bold")}
    onClick={() => editor.chain().focus().toggleBold().run()}
  >
    <strong>B</strong>
  </ToolbarButton>

  {/* <ToolbarButton
    active={editor.isActive("italic")}
    onClick={() => editor.chain().focus().toggleItalic().run()}
  >
    <em>I</em>
  </ToolbarButton> */}

  {/* <ToolbarButton
    active={editor.isActive("heading", {level: 2})}
    onClick={() =>
      editor.chain().focus().toggleHeading({level: 2}).run()
    }
  >
    H2
  </ToolbarButton>

  <ToolbarButton
    active={editor.isActive("heading", {level: 3})}
    onClick={() =>
      editor.chain().focus().toggleHeading({level: 3}).run()
    }
  >
    H3
  </ToolbarButton> */}

  <ToolbarButton
    active={editor.isActive("bulletList")}
    onClick={() =>
      editor.chain().focus().toggleBulletList().run()
    }
  >
    • List
  </ToolbarButton>

  <ToolbarButton
    active={editor.isActive("orderedList")}
    onClick={() =>
      editor.chain().focus().toggleOrderedList().run()
    }
  >
    1. List
  </ToolbarButton>

  <ToolbarButton
    active={editor.isActive("link")}
    onClick={() => {
      const previous =
        editor.getAttributes("link").href || "";

      const url = window.prompt(
        "Enter URL",
        previous,
      );

      if (url === null) return;

      if (url === "") {
        editor.chain().focus().unsetLink().run();
        return;
      }

      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({
          href: url,
        })
        .run();
    }}
  >
    🔗 Link
  </ToolbarButton>

  <ToolbarButton
    active={false}
    onClick={() =>
      editor.chain().focus().unsetLink().run()
    }
  >
    ❌ Unlink
  </ToolbarButton>

  <ToolbarButton
    active={false}
    onClick={() =>
      editor.chain().focus().undo().run()
    }
  >
    Undo
  </ToolbarButton>

  <ToolbarButton
    active={false}
    onClick={() =>
      editor.chain().focus().redo().run()
    }
  >
    Redo
  </ToolbarButton>
</div>

      <div
        style={{
          border: "1px solid #d9d9d9",
          borderRadius: 8,
          overflow: "hidden",
          background: "#fff",
        }}
      >
        <EditorContent editor={editor} />
      </div>

      <input
        type="hidden"
        name={name}
        required={required}
        value={json}
        readOnly
      />

      {/* <div
        style={{
          fontSize: 12,
          color: "#6b7280",
        }}
      >
        Supported formatting: <strong>Bold</strong>,
        Headings, Bullet List, Numbered List and Links.
      </div> */}
    </div>
  );
}