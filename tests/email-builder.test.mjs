import assert from 'node:assert/strict';
import { after, test } from 'node:test';
import { JSDOM } from 'jsdom';
import React from 'react';
import {
  parseEmailDocument,
  renderEmailHtml,
  serializeEmailDocument,
  validateEmailDocument,
} from '../dist/esm/index.js';

const dom = new JSDOM('<!doctype html><html><body></body></html>', {
  url: 'https://editor.example/',
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.HTMLElement = dom.window.HTMLElement;
globalThis.Node = dom.window.Node;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
const { createRoot } = await import('react-dom/client');
const { act } = React;

const valid = {
  version: 1,
  blocks: [
    { id: 'heading', type: 'heading', level: 1, text: 'Welcome <friend>' },
    { id: 'copy', type: 'text', text: 'Hello & goodbye' },
    { id: 'image', type: 'image', src: 'images/hero.png', alt: 'A & B' },
    { id: 'button', type: 'button', text: 'Open', href: 'mailto:team@example.com' },
    { id: 'divider', type: 'divider' },
    { id: 'space', type: 'spacer', height: 20 },
  ],
};

test('validates and round-trips the supported versioned email schema', () => {
  assert.deepEqual(validateEmailDocument(valid), []);
  assert.deepEqual(parseEmailDocument(serializeEmailDocument(valid)), valid);
  assert.throws(() => parseEmailDocument('{'), /not valid JSON/);
});

test('exports a table layout with inline styles and escaped text and attributes', () => {
  const html = renderEmailHtml(valid);
  assert.match(html, /<table role="presentation"/);
  assert.match(html, /style="[^"]*font-family:Arial,sans-serif/);
  assert.match(html, /Welcome &lt;friend&gt;/);
  assert.match(html, /Hello &amp; goodbye/);
  assert.match(html, /src="images\/hero\.png" alt="A &amp; B"/);
  assert.match(html, /href="mailto:team@example\.com"/);
  assert.doesNotMatch(html, /<script/i);
});

test('rejects script schemes, protocol-relative URLs, unsafe styles, and duplicate ids', () => {
  const bad = {
    version: 1,
    blocks: [
      { id: 'same', type: 'image', src: 'javascript:alert(1)', alt: 'bad' },
      {
        id: 'same',
        type: 'button',
        href: '//evil.example',
        text: 'bad',
        style: { backgroundColor: 'url(javascript:1)' },
      },
    ],
  };
  const issues = validateEmailDocument(bad);
  assert.equal(issues.length, 4);
  assert.throws(() => renderEmailHtml(bad), /unsafe scheme/);
  assert.doesNotMatch(renderEmailHtml(valid), /onerror|onclick|<script/i);
});

test('renderer reports invalid documents rather than exporting malformed or unsafe markup', () => {
  assert.throws(() => renderEmailHtml({ version: 2, blocks: [] }), /version 1/);
  assert.match(
    validateEmailDocument({ version: 1, blocks: [{ id: 'x', type: 'spacer', height: NaN }] })[0]
      .message,
    /between 0 and 1000/,
  );
});

test('editor adds, selects, edits, serializes, and undoes through jsdom interactions', async () => {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  const { EmailBuilder } = await import('../dist/esm/index.js');
  await act(async () => root.render(React.createElement(EmailBuilder)));
  const addButton = [...host.querySelectorAll('button')].find(
    (button) => button.textContent === 'Add text',
  );
  assert.ok(addButton);
  await act(async () => addButton.click());
  const textField = host.querySelector('textarea[aria-label="Text"]');
  assert.ok(textField);
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLTextAreaElement.prototype, 'value').set.call(
      textField,
      'Updated message',
    );
    textField.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
    textField.dispatchEvent(new dom.window.Event('change', { bubbles: true }));
  });
  assert.match(host.querySelector('textarea[aria-label="JSON output"]').value, /Updated message/);
  assert.match(host.querySelector('textarea[aria-label="HTML export"]').value, /Updated message/);
  await act(async () => host.querySelector('button[aria-label="Undo"]').click());
  assert.match(
    host.querySelector('textarea[aria-label="JSON output"]').value,
    /Write your email text here/,
  );
  await act(async () => root.unmount());
  host.remove();
});

after(() => dom.window.close());
