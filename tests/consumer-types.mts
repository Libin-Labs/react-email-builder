import { EmailBuilder, renderEmailHtml, type EmailDocument } from '@lp-labs/react-email-builder';

const email: EmailDocument = { version: 1, blocks: [{ id: 'x', type: 'text', text: 'ok' }] };
void EmailBuilder;
void renderEmailHtml(email);
