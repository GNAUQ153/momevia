import test from 'node:test';
import assert from 'node:assert/strict';
import {
  START, END, changelogHighlights, selectCommits,
  renderAutoSection, replaceAutoSection,
} from '../../scripts/docs/update-readme.mjs';

test('README sync only replaces the delimited block, preserving hand-written sections', () => {
  const original = `# Momevia\n\n## Tech stack\nKept forever\n\n${START}\nOld\n${END}\n\n## Localhost\nDo not edit\n`;
  const content = '### Status\n- Changed';
  const result = replaceAutoSection(original, content);
  assert.match(result, /## Tech stack\nKept forever/);
  assert.match(result, /## Localhost\nDo not edit/);
  assert.match(result, /### Status\n- Changed/);
  assert.equal(replaceAutoSection(result, content), result);
});

test('README sync respects CRLF files on Windows', () => {
  const original = `# Momevia\r\n${START}\r\nOld\r\n${END}\r\n`;
  const result = replaceAutoSection(original, 'Line1\nLine2');
  assert(result.includes('Line1\r\nLine2'));
  assert(!/(?<!\r)\n/.test(result));
});

test('README sync refuses missing or duplicate markers', () => {
  assert.throws(() => replaceAutoSection('# README', 'x'), /đúng một cặp/);
  assert.throws(() => replaceAutoSection(`${START}\n${END}\n${END}`, 'x'), /đúng một cặp/);
});

test('README snapshot reflects changelog but never invents missing features', () => {
  const updates = changelogHighlights('# Changelog\n## Unreleased — sprint\n- Payment reconciliation\n- Creator moderation\n## 1.1.0\n- Old feature');
  assert.deepEqual(updates, ['Payment reconciliation', 'Creator moderation']);
  assert.deepEqual(changelogHighlights('## 1.1.0\n- Older feature'), []);
});

test('README recent commits filter bot commits and escape markdown', () => {
  const commits = [
    { hash: 'abcdef12', date: '2026-11-18', subject: 'docs(readme): sync version and recent changes [skip ci]' },
    { hash: '12345678', date: '2026-11-18', subject: 'feat: add [Creator] editor' },
  ];
  assert.equal(selectCommits(commits).length, 1);
  const section = renderAutoSection({ version: '1.1.0', changelog: '# Unreleased\n- New endpoint', commits });
  assert.match(section, /1\.1\.0/);
  assert.match(section, /New endpoint/);
  assert.match(section, /12345678/);
  assert.match(section, /\\\[Creator\\\]/);
  assert.doesNotMatch(section, /docs\(readme\)/);
});
