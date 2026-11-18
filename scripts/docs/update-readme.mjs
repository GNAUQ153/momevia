import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const START = '<!-- MOMEVIA-AUTO-START -->';
export const END = '<!-- MOMEVIA-AUTO-END -->';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

function markdownSafe(input, preserveInlineMarkdown = false) {
  const cleaned = String(input).replace(/[\r\n\t]/g, ' ').replace(/[<>]/g, '').trim();
  return preserveInlineMarkdown ? cleaned : cleaned.replaceAll('`', '\\`')
    .replaceAll('[', '\\[').replaceAll(']', '\\]');
}

export function changelogHighlights(text, limit = 4) {
  const lines = text.split(/\r?\n/);
  const first = lines.findIndex(line => /^#{1,3}\s+(?:Unreleased|Chưa phát hành)\b/i.test(line));
  if (first === -1) return [];
  const results = [];
  for (let i = first + 1; i < lines.length && results.length < limit; i++) {
    if (/^#{1,3}\s+/.test(lines[i])) break;
    const match = /^\s*-\s+(.+)/.exec(lines[i]);
    if (match) results.push(markdownSafe(match[1], true));
  }
  return results;
}

export function selectCommits(commits, limit = 6) {
  return commits.filter(commit => commit && !/^(?:docs\(readme\):|baseline:)/i.test(commit.subject))
    .slice(0, limit).map(({ hash, date, subject }) => ({
      hash: String(hash).slice(0, 12).replace(/[^a-f0-9]/gi, ''),
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
      subject: markdownSafe(subject),
    }));
}

export function renderAutoSection({ version, changelog, commits }) {
  const highlights = changelogHighlights(changelog);
  const recent = selectCommits(commits);
  const lines = [
    '### Phiên bản và cập nhật gần đây',
    '',
    `**Phiên bản trong package.json:** \`${markdownSafe(version)}\` (không đồng nghĩa đã phát hành production).`,
    '',
    '**Các chức năng/thay đổi gần đây được ghi nhận trong CHANGELOG:**',
    '',
    ...(highlights.length ? highlights.map(item => `- ${item}`) : ['- Chưa có mục `Unreleased` trong `CHANGELOG.md`.']),
    '',
    '**Các commit gần nhất trên `main`:**',
    '',
    ...(recent.length ? recent.map(c => `- \`${c.hash}\` — ${c.subject}${c.date ? ` (${c.date})` : ''}`) : ['- Chưa có lịch sử commit để hiển thị.']),
    '',
    '> Mục này được đồng bộ tự động sau khi CI đạt. Để thông tin tính năng chính xác, mỗi thay đổi nghiệp vụ phải được ghi trong `CHANGELOG.md` và dùng commit message rõ ràng.',
  ];
  return lines.join('\n');
}

export function replaceAutoSection(readme, content) {
  const start = readme.indexOf(START);
  const end = readme.indexOf(END);
  if (start === -1 || end === -1 || end <= start || readme.indexOf(START, start + START.length) !== -1 || readme.indexOf(END, end + END.length) !== -1) {
    throw new Error('README.md phải có đúng một cặp MOMEVIA-AUTO-START / MOMEVIA-AUTO-END. Không ghi đè nội dung thủ công.');
  }
  const eol = readme.includes('\r\n') ? '\r\n' : '\n';
  const normalized = content.replace(/\r?\n/g, eol);
  return readme.slice(0, start + START.length) + eol + normalized + eol + readme.slice(end);
}

function recentGitCommits(cwd) {
  if (!fs.existsSync(path.join(cwd, '.git'))) return [];
  const output = execFileSync('git', ['log', '--first-parent', '--format=%h%x09%cs%x09%s', '-n', '35'], {
    cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
  });
  return output.split(/\r?\n/).filter(Boolean).map(line => {
    const [hash, date, ...subject] = line.split('\t');
    return { hash, date, subject: subject.join(' ') };
  });
}

export function syncReadme(cwd = root) {
  const readmePath = path.join(cwd, 'README.md');
  const current = fs.readFileSync(readmePath, 'utf8');
  const pkg = JSON.parse(fs.readFileSync(path.join(cwd, 'package.json'), 'utf8'));
  const changelog = fs.readFileSync(path.join(cwd, 'CHANGELOG.md'), 'utf8');
  const section = renderAutoSection({ version: pkg.version, changelog, commits: recentGitCommits(cwd) });
  const next = replaceAutoSection(current, section);
  if (next === current) {
    console.log('README already synchronized.');
    return false;
  }
  fs.writeFileSync(readmePath, next, 'utf8');
  console.log('README updated: version, changelog highlights and recent commits.');
  return true;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  syncReadme();
}
