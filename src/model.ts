export type EmailAlign = 'left' | 'center' | 'right';

export interface EmailBlockStyle {
  color?: string;
  backgroundColor?: string;
  padding?: number;
  textAlign?: EmailAlign;
  fontSize?: number;
}

export interface EmailTextBlock {
  id: string;
  type: 'text';
  text: string;
  style?: EmailBlockStyle;
}

export interface EmailHeadingBlock {
  id: string;
  type: 'heading';
  text: string;
  level: 1 | 2 | 3;
  style?: EmailBlockStyle;
}

export interface EmailImageBlock {
  id: string;
  type: 'image';
  src: string;
  alt: string;
  style?: EmailBlockStyle;
}

export interface EmailButtonBlock {
  id: string;
  type: 'button';
  text: string;
  href: string;
  style?: EmailBlockStyle;
}

export interface EmailDividerBlock {
  id: string;
  type: 'divider';
  style?: EmailBlockStyle;
}

export interface EmailSpacerBlock {
  id: string;
  type: 'spacer';
  height: number;
  style?: EmailBlockStyle;
}

export type EmailBlock =
  | EmailTextBlock
  | EmailHeadingBlock
  | EmailImageBlock
  | EmailButtonBlock
  | EmailDividerBlock
  | EmailSpacerBlock;
export interface EmailDocument {
  version: 1;
  blocks: EmailBlock[];
}

export interface ValidationIssue {
  path: string;
  message: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export function isSafeUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return false;
  if (/^[a-z][a-z\d+.-]*:/i.test(trimmed)) return /^(https?:|mailto:|tel:)/i.test(trimmed);
  return !trimmed.startsWith('//');
}

function validStyle(value: unknown): value is EmailBlockStyle {
  if (value === undefined) return true;
  if (!isRecord(value)) return false;
  if (
    value.color !== undefined &&
    (typeof value.color !== 'string' || !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.color))
  )
    return false;
  if (
    value.backgroundColor !== undefined &&
    (typeof value.backgroundColor !== 'string' ||
      !/^#(?:[\da-f]{3}|[\da-f]{6})$/i.test(value.backgroundColor))
  )
    return false;
  if (
    value.padding !== undefined &&
    (typeof value.padding !== 'number' ||
      !Number.isFinite(value.padding) ||
      value.padding < 0 ||
      value.padding > 100)
  )
    return false;
  if (
    value.fontSize !== undefined &&
    (typeof value.fontSize !== 'number' ||
      !Number.isFinite(value.fontSize) ||
      value.fontSize < 8 ||
      value.fontSize > 48)
  )
    return false;
  return (
    value.textAlign === undefined ||
    value.textAlign === 'left' ||
    value.textAlign === 'center' ||
    value.textAlign === 'right'
  );
}

export function validateEmailDocument(value: unknown): ValidationIssue[] {
  if (!isRecord(value) || value.version !== 1 || !Array.isArray(value.blocks)) {
    return [{ path: '$', message: 'Expected a version 1 email document with a blocks array.' }];
  }
  const issues: ValidationIssue[] = [];
  const ids = new Set<string>();
  value.blocks.forEach((entry, index) => {
    const path = `$.blocks[${index}]`;
    if (!isRecord(entry)) {
      issues.push({ path, message: 'Expected a block object.' });
      return;
    }
    if (typeof entry.id !== 'string' || !entry.id.trim())
      issues.push({ path: `${path}.id`, message: 'A non-empty id is required.' });
    else if (ids.has(entry.id))
      issues.push({ path: `${path}.id`, message: 'Block ids must be unique.' });
    else ids.add(entry.id);
    if (!validStyle(entry.style))
      issues.push({
        path: `${path}.style`,
        message: 'Style contains unsupported or out-of-range values.',
      });
    const text = (key: string) => {
      if (typeof entry[key] !== 'string')
        issues.push({ path: `${path}.${key}`, message: 'Expected text.' });
    };
    switch (entry.type) {
      case 'text':
        text('text');
        break;
      case 'heading':
        text('text');
        if (entry.level !== 1 && entry.level !== 2 && entry.level !== 3)
          issues.push({ path: `${path}.level`, message: 'Heading level must be 1, 2, or 3.' });
        break;
      case 'image':
        text('src');
        text('alt');
        if (typeof entry.src === 'string' && !isSafeUrl(entry.src))
          issues.push({
            path: `${path}.src`,
            message: 'Image URL uses an unsupported or unsafe scheme.',
          });
        break;
      case 'button':
        text('text');
        text('href');
        if (typeof entry.href === 'string' && !isSafeUrl(entry.href))
          issues.push({
            path: `${path}.href`,
            message: 'Link URL uses an unsupported or unsafe scheme.',
          });
        break;
      case 'divider':
        break;
      case 'spacer':
        if (
          typeof entry.height !== 'number' ||
          !Number.isFinite(entry.height) ||
          entry.height < 0 ||
          entry.height > 1000
        )
          issues.push({
            path: `${path}.height`,
            message: 'Spacer height must be between 0 and 1000 pixels.',
          });
        break;
      default:
        issues.push({ path: `${path}.type`, message: 'Unsupported block type.' });
    }
  });
  return issues;
}

export function parseEmailDocument(json: string): EmailDocument {
  let value: unknown;
  try {
    value = JSON.parse(json) as unknown;
  } catch {
    throw new Error('Email JSON is not valid JSON.');
  }
  const issues = validateEmailDocument(value);
  if (issues.length)
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  return value as EmailDocument;
}

export function serializeEmailDocument(document: EmailDocument): string {
  const issues = validateEmailDocument(document);
  if (issues.length)
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  return JSON.stringify(document, null, 2);
}
