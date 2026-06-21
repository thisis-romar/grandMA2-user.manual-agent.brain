import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chunkBody, slugifyAnchor } from '../src/chunk.js';

test('slugifyAnchor produces anchor-safe tokens', () => {
  assert.equal(slugifyAnchor('Usage & Examples'), 'usage-examples');
  assert.equal(slugifyAnchor('  Trim This  '), 'trim-this');
});

test('chunkBody splits at level >= 2 headings with a lead chunk', () => {
  const body = ['# Title', 'intro line', '', '## Usage', 'do this', '## Examples', 'like so'].join(
    '\n',
  );
  const chunks = chunkBody('note_x', body);
  assert.equal(chunks.length, 3);

  const [lead, usage, examples] = chunks;
  assert.equal(lead.heading, '');
  assert.equal(lead.id, 'note_x');
  assert.match(lead.body, /# Title/);
  assert.match(lead.body, /intro line/);

  assert.equal(usage.heading, 'Usage');
  assert.equal(usage.anchor, 'usage');
  assert.equal(usage.level, 2);
  assert.equal(usage.id, 'note_x#usage');
  assert.match(usage.body, /do this/);

  assert.equal(examples.anchor, 'examples');
});

test('chunkBody de-dupes repeated heading anchors', () => {
  const body = ['## Notes', 'a', '## Notes', 'b'].join('\n');
  const anchors = chunkBody('n', body).map((c) => c.anchor);
  assert.deepEqual(anchors, ['notes', 'notes-2']);
});

test('chunkBody on a heading-less body yields a single lead chunk', () => {
  const chunks = chunkBody('n', 'just one paragraph');
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].anchor, '');
  assert.equal(chunks[0].id, 'n');
});
