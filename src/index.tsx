import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import { renderEmailHtml } from './html.js';
import {
  isSafeUrl,
  serializeEmailDocument,
  validateEmailDocument,
  type EmailBlock,
  type EmailBlockStyle,
  type EmailDocument,
} from './model.js';
export * from './model.js';
export { escapeHtml, renderEmailHtml } from './html.js';

export interface EmailBuilderProps {
  value?: EmailDocument;
  defaultValue?: EmailDocument;
  onChange?: (document: EmailDocument) => void;
  className?: string;
}

const emptyDocument: EmailDocument = { version: 1, blocks: [] };
let nextId = 0;
const labels = ['text', 'heading', 'image', 'button', 'divider', 'spacer'] as const;
type EmailKind = (typeof labels)[number];

function createBlock(type: EmailKind): EmailBlock {
  const id = `email-block-${Date.now().toString(36)}-${(++nextId).toString(36)}`;
  switch (type) {
    case 'text':
      return { id, type, text: 'Write your email text here' };
    case 'heading':
      return { id, type, text: 'New heading', level: 2 };
    case 'image':
      return { id, type, src: '', alt: 'Describe this image' };
    case 'button':
      return { id, type, text: 'Learn more', href: 'https://example.com' };
    case 'divider':
      return { id, type };
    case 'spacer':
      return { id, type, height: 24 };
  }
}

function title(block: EmailBlock): string {
  if (block.type === 'text' || block.type === 'heading' || block.type === 'button')
    return `${block.type}: ${block.text || '(empty)'}`;
  if (block.type === 'image') return `image: ${block.alt || '(no alt text)'}`;
  return block.type;
}

function visualStyle(style: EmailBlockStyle | undefined): CSSProperties {
  return {
    color: style?.color,
    backgroundColor: style?.backgroundColor,
    padding: style?.padding,
    textAlign: style?.textAlign,
    fontSize: style?.fontSize,
  };
}

function PreviewBlock({ block }: { block: EmailBlock }): ReactNode {
  const style = visualStyle(block.style);
  switch (block.type) {
    case 'text':
      return <p style={style}>{block.text}</p>;
    case 'heading': {
      const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3';
      return <Tag style={style}>{block.text}</Tag>;
    }
    case 'image':
      return isSafeUrl(block.src) ? (
        <img src={block.src} alt={block.alt} style={{ ...style, maxWidth: '100%' }} />
      ) : (
        <span>Unsafe image URL</span>
      );
    case 'button':
      return isSafeUrl(block.href) ? (
        <a href={block.href} style={style}>
          {block.text}
        </a>
      ) : (
        <span>{block.text}</span>
      );
    case 'divider':
      return <hr style={style} />;
    case 'spacer':
      return <div aria-hidden="true" style={{ height: block.height }} />;
  }
}

export function EmailBuilder({
  value,
  defaultValue = emptyDocument,
  onChange,
  className,
}: EmailBuilderProps) {
  const controlled = value !== undefined;
  const [internal, setInternal] = useState<EmailDocument>(defaultValue);
  const document = controlled ? value : internal;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [history, setHistory] = useState<EmailDocument[]>([]);
  const [future, setFuture] = useState<EmailDocument[]>([]);
  const selected = useMemo(
    () => document.blocks.find((block) => block.id === selectedId),
    [document, selectedId],
  );
  const apply = (next: EmailDocument, saveHistory = true) => {
    if (saveHistory) {
      setHistory((items) => [...items.slice(-49), document]);
      setFuture([]);
    }
    if (!controlled) setInternal(next);
    onChange?.(next);
  };
  const add = (kind: EmailKind) => {
    const block = createBlock(kind);
    apply({ ...document, blocks: [...document.blocks, block] });
    setSelectedId(block.id);
  };
  const remove = (id: string) => {
    apply({ ...document, blocks: document.blocks.filter((block) => block.id !== id) });
    if (selectedId === id) setSelectedId(null);
  };
  const update = (changes: Partial<EmailBlock>) => {
    if (selected)
      apply({
        ...document,
        blocks: document.blocks.map((block) =>
          block.id === selected.id ? ({ ...block, ...changes } as EmailBlock) : block,
        ),
      });
  };
  const updateStyle = (key: keyof EmailBlockStyle, entry: string) => {
    if (!selected) return;
    const valueForKey = key === 'padding' || key === 'fontSize' ? Number(entry) : entry;
    update({ style: { ...selected.style, [key]: valueForKey } });
  };
  const move = (id: string, direction: -1 | 1) => {
    const index = document.blocks.findIndex((block) => block.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= document.blocks.length) return;
    const blocks = [...document.blocks];
    [blocks[index], blocks[target]] = [blocks[target], blocks[index]];
    apply({ ...document, blocks });
  };
  const undo = () => {
    if (!history.length) return;
    setFuture((items) => [...items, document]);
    apply(history[history.length - 1], false);
    setHistory(history.slice(0, -1));
  };
  const redo = () => {
    if (!future.length) return;
    setHistory((items) => [...items, document]);
    apply(future[future.length - 1], false);
    setFuture(future.slice(0, -1));
  };
  const issues = validateEmailDocument(document);
  let html = '';
  try {
    html = renderEmailHtml(document);
  } catch {
    html = '';
  }
  const updateText = (key: 'text' | 'alt' | 'href' | 'src', entry: string) =>
    update({ [key]: entry } as Partial<EmailBlock>);
  return (
    <div className={`lp-email-builder${className ? ` ${className}` : ''}`}>
      <header className="lp-email-toolbar">
        <strong>Email builder</strong>
        <button type="button" onClick={undo} disabled={!history.length} aria-label="Undo">
          Undo
        </button>
        <button type="button" onClick={redo} disabled={!future.length} aria-label="Redo">
          Redo
        </button>
        <label>
          Preview width
          <select
            aria-label="Preview width"
            value={viewport}
            onChange={(event) => setViewport(event.target.value as typeof viewport)}
          >
            <option value="desktop">Desktop</option>
            <option value="tablet">Tablet</option>
            <option value="mobile">Mobile</option>
          </select>
        </label>
      </header>
      <div className="lp-email-workspace">
        <aside className="lp-email-panel" aria-label="Block palette">
          <h2>Add a block</h2>
          <div className="lp-email-palette">
            {labels.map((kind) => (
              <button key={kind} type="button" onClick={() => add(kind)}>
                Add {kind}
              </button>
            ))}
          </div>
          <h2>Document</h2>
          <ol className="lp-email-outline">
            {document.blocks.map((block, index) => (
              <li key={block.id}>
                <button
                  type="button"
                  aria-pressed={selectedId === block.id}
                  onClick={() => setSelectedId(block.id)}
                >
                  {title(block)}
                </button>
                <button
                  type="button"
                  aria-label={`Move ${block.type} up`}
                  disabled={index === 0}
                  onClick={() => move(block.id, -1)}
                >
                  Up
                </button>
                <button
                  type="button"
                  aria-label={`Move ${block.type} down`}
                  disabled={index === document.blocks.length - 1}
                  onClick={() => move(block.id, 1)}
                >
                  Down
                </button>
                <button
                  type="button"
                  aria-label={`Remove ${block.type}`}
                  onClick={() => remove(block.id)}
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        </aside>
        <main className="lp-email-main">
          <section className="lp-email-panel" aria-label="Preview">
            <h2>Preview ({viewport})</h2>
            <div className={`lp-email-preview lp-email-preview-${viewport}`}>
              <div className="lp-email-preview-content">
                {document.blocks.length ? (
                  document.blocks.map((block) => (
                    <div key={block.id} onClick={() => setSelectedId(block.id)}>
                      <PreviewBlock block={block} />
                    </div>
                  ))
                ) : (
                  <p>Add blocks to start building.</p>
                )}
              </div>
            </div>
          </section>
          <section className="lp-email-panel" aria-label="Inspector">
            <h2>Inspector</h2>
            {selected ? (
              <div className="lp-email-inspector">
                {(selected.type === 'text' ||
                  selected.type === 'heading' ||
                  selected.type === 'button') && (
                  <label>
                    Text
                    <textarea
                      aria-label="Text"
                      value={selected.text}
                      onChange={(event) => updateText('text', event.target.value)}
                    />
                  </label>
                )}
                {selected.type === 'heading' && (
                  <label>
                    Heading level
                    <select
                      aria-label="Heading level"
                      value={selected.level}
                      onChange={(event) =>
                        update({ level: Number(event.target.value) as 1 | 2 | 3 })
                      }
                    >
                      <option value="1">H1</option>
                      <option value="2">H2</option>
                      <option value="3">H3</option>
                    </select>
                  </label>
                )}
                {selected.type === 'image' && (
                  <>
                    <label>
                      Image URL
                      <input
                        aria-label="Image URL"
                        value={selected.src}
                        onChange={(event) => updateText('src', event.target.value)}
                      />
                    </label>
                    <label>
                      Alt text
                      <input
                        aria-label="Alt text"
                        value={selected.alt}
                        onChange={(event) => updateText('alt', event.target.value)}
                      />
                    </label>
                  </>
                )}
                {selected.type === 'button' && (
                  <label>
                    Link URL
                    <input
                      aria-label="Link URL"
                      value={selected.href}
                      onChange={(event) => updateText('href', event.target.value)}
                    />
                  </label>
                )}
                {selected.type === 'spacer' && (
                  <label>
                    Height (px)
                    <input
                      aria-label="Height (px)"
                      type="number"
                      min="0"
                      max="1000"
                      value={selected.height}
                      onChange={(event) => update({ height: Number(event.target.value) })}
                    />
                  </label>
                )}
                <label>
                  Text color
                  <input
                    aria-label="Text color"
                    value={selected.style?.color ?? ''}
                    onChange={(event) => updateStyle('color', event.target.value)}
                    placeholder="#222222"
                  />
                </label>
                <label>
                  Background color
                  <input
                    aria-label="Background color"
                    value={selected.style?.backgroundColor ?? ''}
                    onChange={(event) => updateStyle('backgroundColor', event.target.value)}
                    placeholder="#ffffff"
                  />
                </label>
                <label>
                  Padding (px)
                  <input
                    aria-label="Padding (px)"
                    type="number"
                    min="0"
                    max="100"
                    value={selected.style?.padding ?? 0}
                    onChange={(event) => updateStyle('padding', event.target.value)}
                  />
                </label>
                <label>
                  Text alignment
                  <select
                    aria-label="Text alignment"
                    value={selected.style?.textAlign ?? 'left'}
                    onChange={(event) => updateStyle('textAlign', event.target.value)}
                  >
                    <option>left</option>
                    <option>center</option>
                    <option>right</option>
                  </select>
                </label>
                <label>
                  Font size (px)
                  <input
                    aria-label="Font size (px)"
                    type="number"
                    min="8"
                    max="48"
                    value={selected.style?.fontSize ?? 16}
                    onChange={(event) => updateStyle('fontSize', event.target.value)}
                  />
                </label>
              </div>
            ) : (
              <p>Select a block to edit it.</p>
            )}
          </section>
          <section className="lp-email-panel" aria-label="JSON output">
            <h2>JSON</h2>
            <p>{issues.length ? `${issues.length} validation issue(s)` : 'Document is valid'}</p>
            {issues.map((issue, index) => (
              <p role="alert" key={`${issue.path}-${index}`}>
                {issue.path}: {issue.message}
              </p>
            ))}
            <textarea
              aria-label="JSON output"
              readOnly
              value={(() => {
                try {
                  return serializeEmailDocument(document);
                } catch {
                  return JSON.stringify(document, null, 2);
                }
              })()}
            />
          </section>
          <section className="lp-email-panel" aria-label="HTML export">
            <h2>HTML export</h2>
            <textarea aria-label="HTML export" readOnly value={html} />
          </section>
        </main>
      </div>
    </div>
  );
}
