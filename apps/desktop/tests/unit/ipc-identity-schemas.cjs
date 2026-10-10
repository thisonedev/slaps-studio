'use strict';

// Zod schemas guarding the studio:identity:* IPC surface. The renderer is the
// untrusted side of that boundary, so these run on every payload.

const test = require('brittle');

// @studio/validation is ESM, so require() cannot load it; memoised so each test can await it independently of run order.
let pending;
const validation = () => (pending ||= import('@studio/validation'));

test('identity-schemas - mnemonic requires at least 12 words', async (t) => {
  const v = await validation();
  const words12 = Array(12).fill('word').join(' ');
  t.is(v.identityMnemonicSchema.parse(words12), words12);
  t.exception(() => v.identityMnemonicSchema.parse('too few words'));
});

test('identity-schemas - username follows the manager rule', async (t) => {
  const v = await validation();
  t.alike(v.identityUsernameSchema.parse({ username: ' satoshi_1 ' }), { username: 'satoshi_1' });
  t.exception(() => v.identityUsernameSchema.parse({ username: 'ab' }), 'too short');
  t.exception(() => v.identityUsernameSchema.parse({ username: '-dash' }), 'leading dash');
  t.exception(() => v.identityUsernameSchema.parse({ username: 'has space' }));
  t.exception(() => v.identityUsernameSchema.parse({ username: '<img src=x>' }));
});

