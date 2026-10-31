import {
  isSafeUrl,
  validateEmailDocument,
  type EmailBlock,
  type EmailBlockStyle,
  type EmailDocument,
} from './model.js';

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function inlineStyle(style: EmailBlockStyle | undefined, defaults = ''): string {
  const entries = [
    defaults,
    style?.color ? `color:${style.color}` : '',
    style?.backgroundColor ? `background-color:${style.backgroundColor}` : '',
    style?.padding !== undefined ? `padding:${style.padding}px` : '',
    style?.textAlign ? `text-align:${style.textAlign}` : '',
    style?.fontSize !== undefined ? `font-size:${style.fontSize}px` : '',
  ].filter(Boolean);
  return escapeHtml(entries.join(';'));
}

function blockRow(block: EmailBlock): string {
  const style = block.style;
  switch (block.type) {
    case 'text':
      return `<tr><td style="${inlineStyle(style, 'font-family:Arial,sans-serif;font-size:16px;line-height:1.5')}"><p style="margin:0">${escapeHtml(block.text)}</p></td></tr>`;
    case 'heading':
      return `<tr><td style="${inlineStyle(style, 'font-family:Arial,sans-serif;line-height:1.3')}"><h${block.level} style="margin:0">${escapeHtml(block.text)}</h${block.level}></td></tr>`;
    case 'image':
      if (!isSafeUrl(block.src)) return '';
      return `<tr><td style="${inlineStyle(style, 'text-align:center')}"><img src="${escapeHtml(block.src)}" alt="${escapeHtml(block.alt)}" width="100%" style="display:block;width:100%;max-width:600px;height:auto;border:0"></td></tr>`;
    case 'button':
      if (!isSafeUrl(block.href)) return '';
      return `<tr><td align="center" style="${inlineStyle(style, 'padding:16px')}"><table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr><td bgcolor="${escapeHtml(style?.backgroundColor ?? '#1769aa')}" style="border-radius:4px;padding:12px 20px"><a href="${escapeHtml(block.href)}" style="display:inline-block;color:${escapeHtml(style?.color ?? '#ffffff')};font-family:Arial,sans-serif;font-size:${style?.fontSize ?? 16}px;text-decoration:none">${escapeHtml(block.text)}</a></td></tr></table></td></tr>`;
    case 'divider':
      return `<tr><td style="${inlineStyle(style, 'padding:12px 0')}"><div role="separator" style="border-top:1px solid ${escapeHtml(style?.color ?? '#cccccc')};font-size:0;line-height:0">&nbsp;</div></td></tr>`;
    case 'spacer':
      return `<tr><td aria-hidden="true" height="${block.height}" style="height:${block.height}px;font-size:0;line-height:0">&nbsp;</td></tr>`;
  }
}

export function renderEmailHtml(document: EmailDocument): string {
  const issues = validateEmailDocument(document);
  if (issues.length)
    throw new Error(issues.map((issue) => `${issue.path}: ${issue.message}`).join('\n'));
  return `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Email</title></head><body style="margin:0;padding:0"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse"><tr><td align="center" style="padding:0 12px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse">${document.blocks.map(blockRow).join('')}</table></td></tr></table></body></html>`;
}
