import assert from 'node:assert/strict';
import { test } from 'node:test';
import { betaMetrics } from '../../scripts/quality/beta-metrics.mjs';

const at = seconds => `2026-11-18T08:00:${String(seconds).padStart(2, '0')}Z`;
const event = (id, type, seconds, data) => ({ id, type, at: at(seconds), ...data });
const window = { from: at(0), to: at(50) };

test('synthetic beta cohorts use first milestones and ignore preview, unknown opens, duplicates and cutoff', () => {
  const records = [
    event('e1', 'template_approved', 1, { template: 't1', version: 'v1', actor: 'creator' }),
    event('e2', 'template_approved', 2, { template: 't2', version: 'v2', actor: 'creator' }),
    event('e3', 'draft_created', 5, { draft: 'd1', template: 't1', version: 'v1', actor: 'sender', selectedAt: at(4) }),
    event('e4', 'draft_created', 6, { draft: 'd2', template: 't2', version: 'v2', actor: 'creator', selectedAt: at(4) }),
    event('e5', 'draft_created', 7, { draft: 'd3', template: 't1', version: 'v1', actor: 'sender', selectedAt: at(5) }),
    event('e6', 'gift_published', 12, { gift: 'g1', draft: 'd1' }),
    event('e7', 'gift_published', 13, { gift: 'g2', draft: 'd2' }),
    event('e8', 'gift_opened', 14, { gift: 'g1', channel: 'preview' }),
    event('e9', 'gift_opened', 15, { gift: 'g2', channel: 'unclassified' }),
    event('e10', 'gift_opened', 16, { gift: 'g1', channel: 'interaction' }),
    event('e11', 'gift_opened', 17, { gift: 'g1', channel: 'interaction' }),
    event('e12', 'reply_sent', 18, { gift: 'g1', reply: 'r1' }),
    event('e13', 'gift_published', 51, { gift: 'g3', draft: 'd3' }),
  ];
  assert.deepEqual(betaMetrics([...records, records[5]].reverse(), window), {
    draftToPublished: { numerator: 2, denominator: 3, rate: 2 / 3 },
    selectionToLink: { count: 2, medianMs: 8500 },
    publishedToInteractiveOpen: { numerator: 1, denominator: 2, rate: 0.5 },
    openedToReply: { numerator: 1, denominator: 1, rate: 1 },
    creatorTemplatesUsed: { numerator: 1, denominator: 2, rate: 0.5 },
  });
  assert.throws(() => betaMetrics([{ ...records[0], message: 'private' }], window));
  assert.throws(() => betaMetrics([records[0], { ...records[0], actor: 'other' }], window));
});
