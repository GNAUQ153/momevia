import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import jsQR from 'jsqr';
import { chromium } from 'playwright';
import { confirmGiftAccess } from './gift-access.mjs';
import { predictionCard, predictionFields } from '../../web/js/shared/canvas/prediction.js';
import { demoProfile } from '../../scripts/dev/web-demo-config.mjs';
import { canonicalText } from '../../web/js/shared/locale.js';

export async function runPredictionBrowser(base, { account, artifactDir, oldGift, revokedGift, expiredGift } = {}) {
  fs.mkdirSync(artifactDir, { recursive: true });
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || (process.platform === 'win32' ? 'msedge' : undefined) });
  const errors = [], completed = [];
  const sender = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: 'reduce' });
  const receiver = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, reducedMotion: 'reduce' });
  const page = await sender.newPage(), recipient = await receiver.newPage();
  for (const tab of [page, recipient]) {
    tab.on('pageerror', error => errors.push(error.message));
    await tab.addInitScript(() => {
      globalThis.__csp = [];
      globalThis.document.addEventListener('securitypolicyviolation', event => globalThis.__csp.push(event.violatedDirective));
    });
  }
  const sample = Object.fromEntries(Object.keys(predictionFields).map(key => [key, canonicalText('prediction.sample.'+key)]));
  const field = key => page.locator(`[data-editor-field="${key}"]:visible`).first();
  const cardField = key => field(`prediction.prediction-card.${key}`);
  const predictionRadio = id => page.locator(`input[data-editor-field="prediction.prediction-card.prediction"][value="${id}"]:visible`);
  const action = name => page.locator(`[data-editor-action="${name}"]:visible`).first();
  const save = async () => { await action('save').click(); await page.locator('.editor-save-status').filter({ hasText: 'Đã lưu' }).waitFor(); };
  const capture = async (tab, name) => tab.screenshot({ path: path.join(artifactDir, name), fullPage: true });
  const api = async (route, data) => {
    const response = data ? await sender.request.post(base+'/api'+route, { data, headers: { origin: base } }) : await sender.request.get(base+'/api'+route);
    const body = await response.json(); assert(response.ok(), `${route}: ${response.status()} ${JSON.stringify(body)}`); return body;
  };
  async function play(tab, scope, choice, prediction, { keyboard = false, double = false } = {}) {
    assert.equal(await scope.locator('.gift-prediction-guessed').count(), 0);
    assert.equal(await scope.locator('.gift-prediction-ending').count(), 0);
    const tree = await scope.ariaSnapshot();
    assert(!tree.includes(sample.reason)); assert(!tree.includes(sample.endingA)); assert(!tree.includes(sample.endingB));
    const option = scope.getByRole('button', { name: `${choice} - ${sample['option'+choice]}`, exact: true });
    if (double) await scope.locator('.gift-prediction-options').evaluate(root => {
      const buttons = root.querySelectorAll('button'); buttons[1].click(); buttons[0].click(); buttons[1].click();
    });
    else if (keyboard) { await option.focus(); await tab.keyboard.press('Enter'); }
    else await option.tap();
    const guess = scope.locator('.gift-prediction-guessed');
    await guess.waitFor();
    assert.equal(await guess.innerText(), `Minh đã đoán - ${sample['option'+prediction]}`);
    assert.equal(await scope.locator('.gift-prediction-chosen').innerText(), `Cậu vừa chọn - ${sample['option'+choice]}`);
    assert.equal(await scope.locator('.gift-prediction-reason').innerText(), sample.reason);
    await scope.locator('.gift-prediction-ending .gift-interaction-copy').waitFor();
    assert.equal(await scope.locator('.gift-prediction-ending .gift-interaction-copy').innerText(), sample['ending'+choice]);
    assert.equal(await scope.locator('.gift-prediction-ending').count(), 1);
    assert.equal(await scope.getByRole('button', { name: 'Chơi lại', exact: true }).count(), 1);
    completed.push(`Prediction ${prediction}, choice ${choice}${double ? ', rapid alternate taps latched' : ''}${keyboard ? ', keyboard' : ''}`);
  }
  let draftUrl, giftA, giftB;
  try {
    const login = await sender.request.post(base+'/api/auth/login', { data: account, headers: { origin: base } }); assert.equal(login.status(), 200);
    await page.goto(base+'/explore?q='+encodeURIComponent('Tớ đoán'));
    await page.locator('a.template-card__title[href="/template/to-doan-cau-se-chon"]').click();
    await page.getByRole('button', { name: 'Xem thử', exact: true }).click();
    const preview = page.locator('dialog.template-preview-dialog[open]');
    await preview.getByRole('button', { name: 'B - '+sample.optionB, exact: true }).waitFor();
    assert.equal(await preview.locator('.gift-prediction-guessed').count(), 0);
    await preview.getByRole('button', { name: 'B - '+sample.optionB, exact: true }).click();
    await preview.locator('.gift-prediction-ending').waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole('link', { name: 'Dùng mẫu', exact: true }).click();
    await cardField('question').waitFor(); draftUrl = page.url();
    const draftId = new URL(draftUrl).pathname.split('/').at(-1);
    assert.equal(await cardField('question').inputValue(), '');
    await field('binding.senderName').fill('Minh'); await field('binding.recipientName').fill('An');
    await cardField('question').fill(sample.question);
    await save(); await page.reload(); await cardField('question').waitFor();
    assert.equal(await cardField('question').inputValue(), sample.question);
    assert.equal(await predictionRadio('A').isChecked(), false);
    await action('preview').click(); await action('preview-send').click();
    await page.locator('.editor-preflight').waitFor({ state: 'visible' });
    assert.equal(await cardField('question').inputValue(), sample.question);
    completed.push('Incomplete draft saves/reloads and preflight retains entered question');
    for (const [key, value] of Object.entries(sample)) await cardField(key).fill(value);
    await predictionRadio('A').check();
    await cardField('optionA').fill('Quán mì vừa đổi tên');
    assert(await predictionRadio('A').isChecked());
    assert.equal(await predictionRadio('A').locator('..').innerText(), 'A - Quán mì vừa đổi tên');
    await save(); await page.reload(); await cardField('question').waitFor();
    assert(await predictionRadio('A').isChecked());
    assert.equal(await cardField('optionA').inputValue(), 'Quán mì vừa đổi tên');
    await action('toggle-mode').click();
    await action('toggle-mode').click();
    assert(await predictionRadio('A').isChecked());
    await cardField('optionA').fill(sample.optionA);
    await cardField('optionB').fill('  Quán mì   hồi năm nhất  ');
    await action('preview').click(); await action('preview-send').click();
    const duplicate = page.getByRole('button', { name: 'Lựa chọn B cần khác lựa chọn A sau khi bỏ khoảng trắng thừa.', exact: true });
    await duplicate.waitFor(); await duplicate.click();
    assert.equal(await cardField('optionB').evaluate(node => node === globalThis.document.activeElement), true);
    await cardField('optionB').fill(sample.optionB);
    // A blocker also focuses the correct inspector field in layout mode.
    await cardField('reason').fill(''); await action('toggle-mode').click();
    await action('publish').click();
    await page.getByRole('button', { name: 'Cần điền “Vì sao cậu đoán như vậy?”.', exact: true }).click();
    assert.equal(await cardField('reason').evaluate(node => node === globalThis.document.activeElement), true);
    await cardField('reason').fill(sample.reason);
    await page.locator('.editor-inspector [data-editor-action="close-sheet"]:visible').click();
    await action('toggle-mode').click();
    await page.locator('.editor-top-actions [data-locale-select]').selectOption('en');
    await page.getByRole('group', { name: 'What do you think your friend will choose?', exact: true }).waitFor();
    assert.equal(await cardField('question').inputValue(), sample.question);
    await page.locator('.editor-top-actions [data-locale-select]').selectOption('vi');
    await save();
    const before = (await api(`/designs/designs/${draftId}`)).design;
    assert.equal(predictionCard(before.document).props.prediction, 'A');
    await action('preview').click();
    const draftPreview = page.locator('dialog[open] .gift-runtime-stage');
    await play(page, draftPreview, 'B', 'A', { keyboard: true });
    await capture(page, 'sender-preview-B.png');
    await action('preview-send').click();
    await confirmGiftAccess(page, { open: 'link', send: 'disabled', read: 'sender' });
    await page.waitForURL('**/success/*');
    giftA = await page.locator('#share-link').inputValue();
    await page.locator('[data-action="qr"]').click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Tải mã QR', exact: true }).click();
    const download = await downloadPromise;
    const { data, info } = await sharp(await download.path()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    assert.equal(jsQR(new Uint8ClampedArray(data), info.width, info.height)?.data, giftA);
    completed.push('Downloaded QR decodes to the exact published gift URL');
    assert.equal((await receiver.cookies()).length, 0);
    await recipient.goto(giftA);
    const stage = recipient.locator('.gift-runtime-stage');
    await stage.getByRole('button', { name: 'A - '+sample.optionA, exact: true }).waitFor();
    assert.equal(await recipient.locator('.gift-runtime-navigation button').count(), 1);
    assert.equal(await recipient.locator('.gift-runtime-navigation').innerText(), '1. Mở quà');
    await capture(recipient, 'recipient-question-390.png');
    await play(recipient, stage, 'B', 'A', { double: true });
    await capture(recipient, 'recipient-A-B-390.png');
    await stage.getByRole('button', { name: 'Chơi lại', exact: true }).tap();
    await play(recipient, stage, 'A', 'A', { keyboard: true });
    await capture(recipient, 'recipient-A-A-390.png');
    await recipient.reload();
    await stage.getByRole('button', { name: 'B - '+sample.optionB, exact: true }).waitFor();
    assert.equal(await stage.locator('.gift-prediction-guessed').count(), 0);
    completed.push('Published gift opened without sender cookies, replay and reload reset choice');
    const slugA = new URL(giftA).pathname.split('/').at(-1);
    const publicA = (await api(`/gifts/gifts/${slugA}`)).gift;
    assert.deepEqual(predictionCard(publicA.documentSnapshot).props, predictionCard(before.document).props);
    // Edit sender draft after publish; the original gift must stay frozen at A.
    await page.goto(draftUrl); await cardField('question').waitFor();
    await predictionRadio('B').check(); await cardField('reason').fill('Lý do đã sửa sau khi gửi'); await save();
    await recipient.reload(); await play(recipient, stage, 'B', 'A');
    completed.push('Published A unchanged after draft prediction/reason edits');
    await cardField('reason').fill(sample.reason); await save();
    await action('preview').click(); await action('preview-send').click();
    await confirmGiftAccess(page, { open: 'link', send: 'disabled', read: 'sender' });
    await page.waitForURL('**/success/*'); giftB = await page.locator('#share-link').inputValue();
    await recipient.goto(giftB); await play(recipient, stage, 'A', 'B', { keyboard: true });
    await capture(recipient, 'recipient-B-A-390.png');
    await stage.getByRole('button', { name: 'Chơi lại', exact: true }).tap();
    await play(recipient, stage, 'B', 'B');
    await capture(recipient, 'recipient-B-B-390.png');
    // Language preference changes only system copy, preserving the played branch.
    await recipient.locator('.recipient-preferences [data-locale-select]').selectOption('en');
    await stage.getByRole('button', { name: 'Play again', exact: true }).waitFor();
    assert.equal(await stage.locator('.gift-prediction-ending .gift-interaction-copy').innerText(), sample.endingB);
    assert.equal(await stage.locator('.gift-prediction-guessed').innerText(), 'Minh guessed - '+sample.optionB);
    await recipient.locator('.recipient-preferences [data-locale-select]').selectOption('vi');
    // Long copy and 320px do not overflow; use real UI input + preview.
    await page.goto(draftUrl); await cardField('question').waitFor();
    const longLabel = 'Bữa ăn sinh nhật thật dài với những người bạn cũ, rồi cùng nhau dạo quanh phố và kể chuyện năm nhất';
    await cardField('optionA').fill(longLabel);
    await cardField('reason').fill('Một kỷ niệm dài. '.repeat(55));
    await cardField('endingA').fill('Một lời hẹn dài. '.repeat(55));
    await action('preview').click();
    await page.setViewportSize({ width: 320, height: 740 });
    const longOption = page.locator('dialog[open]').getByRole('button', { name: 'A - '+longLabel, exact: true });
    await longOption.waitFor();
    const box = await longOption.boundingBox(); assert(box.width <= 320 && box.height >= 44);
    assert.equal(await longOption.evaluate(node => node.scrollWidth <= node.clientWidth+1), true);
    await capture(page, 'long-label-320.png');
    await longOption.click();
    const longRoot = page.locator('dialog[open] .gift-runtime-prediction-choice');
    const longEnding = longRoot.locator('.gift-prediction-ending');
    await longEnding.waitFor();
    assert.equal(await longEnding.evaluate(node => node.scrollWidth <= node.clientWidth+1), true);
    await longRoot.getByRole('button', { name: 'Chơi lại', exact: true }).click();
    const replayBox = await longOption.boundingBox();
    assert(replayBox.y >= 0 && replayBox.y + replayBox.height <= 740, JSON.stringify(replayBox));
    await action('preview-close').click(); await page.setViewportSize({ width: 390, height: 844 });
    // Regift through Studio action, opening a real clean draft.
    await page.goto(base+'/studio');
    await page.locator(`[data-action="regift"][data-id="${slugA}"]`).click();
    await page.waitForURL('**/design/*');
    const cleanId = new URL(page.url()).pathname.split('/').at(-1);
    await page.locator('[data-prediction-fields]').first().waitFor();
    const cleaned = (await api(`/designs/designs/${cleanId}`)).design.document;
    assert(Object.values(cleaned.bindings).every(b => b.value === ''));
    const p = predictionCard(cleaned).props; assert.equal(p.prediction, null);
    assert(Object.keys(predictionFields).every(key => p[key] === ''));
    completed.push('Studio regift creates blank names/story/prediction; long labels fit 320px; VI/EN preserves author copy');
    // Revocation must remove the actual new published gift from the recipient.
    const slugB = new URL(giftB).pathname.split('/').at(-1);
    await api(`/gifts/gifts/mine/${slugB}/revoke`, {});
    await recipient.goto(giftB); await recipient.getByText('Người gửi đã ngừng chia sẻ món quà này.', { exact: true }).waitFor();
    assert.equal(await recipient.locator('.gift-runtime-prediction-choice').count(), 0);
    for (const [name, url] of [['old', oldGift], ['revoked', revokedGift], ['expired', expiredGift]]) if (url) {
      await recipient.goto(url); await recipient.waitForLoadState('networkidle');
      if (name === 'old') await recipient.locator('.gift-runtime-stage').waitFor();
      else {
        await recipient.getByText(name === 'revoked' ? 'Người gửi đã ngừng chia sẻ món quà này.' : 'Món quà đã hết thời gian hoạt động.', { exact: true }).waitFor();
        assert.equal(await recipient.locator('.gift-runtime-prediction-choice').count(), 0);
      }
      await capture(recipient, `${name}-gift.png`);
    }
    completed.push('Revoked prediction gift blocked; seeded old, revoked and expired gifts checked');
    // Normal-motion timeline: guess first, ending later; reload cancels old timers.
    await recipient.emulateMedia({ reducedMotion: 'no-preference' });
    await recipient.goto(giftA);
    await stage.getByRole('button', { name: 'B - '+sample.optionB }).tap();
    await stage.locator('.gift-prediction-guessed').waitFor();
    assert.equal(await stage.locator('.gift-prediction-ending').count(), 0);
    await stage.locator('.gift-prediction-ending').waitFor();
    await recipient.reload(); await stage.getByRole('button', { name: 'A - '+sample.optionA }).tap();
    await recipient.reload(); await recipient.waitForTimeout(4600);
    assert.equal(await stage.locator('.gift-prediction-guessed').count(), 0);
    completed.push('Normal-motion reveal order and stale timer cancellation; reduced-motion immediate results');
    // Leave the sender's filming draft with the exact same story as the A snapshot.
    await page.goto(draftUrl); await cardField('question').waitFor();
    for (const [key, value] of Object.entries(sample)) await cardField(key).fill(value);
    await predictionRadio('A').check(); await save();
    await capture(page, 'sender-ready-390.png');
    assert.deepEqual(errors, []);
    assert.deepEqual(await page.evaluate(() => globalThis.__csp), []);
    assert.deepEqual(await recipient.evaluate(() => globalThis.__csp), []);
    const handoff = { base, gift: giftA, share: base+'/success/'+slugA, draft: draftUrl, prediction: 'A', sender: 'Minh', recipient: 'An', recordedAt: new Date().toISOString(), completed, environment: 'Windows, Edge headless, 390×844 touch emulation and 320×740; no physical phone tested' };
    fs.writeFileSync(path.join(artifactDir, 'result.json'), JSON.stringify(handoff, null, 2)+'\n');
    console.log(JSON.stringify(handoff, null, 2));
    return handoff;
  } catch (error) {
    await capture(page, 'FAIL-sender.png').catch(() => {}); await capture(recipient, 'FAIL-recipient.png').catch(() => {});
    console.error('Browser progress:', completed, '\nURL:', page.url(), '\nErrors:', errors);
    throw error;
  } finally { await browser.close(); }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const configuredBase = process.env.PREDICTION_DEMO_BASE;
  const port = configuredBase ? Number(new URL(configuredBase).port || 4110) : 4110;
  const profile = demoProfile(process.cwd(), port, process.env.PREDICTION_DEMO_PROFILE);
  const httpsFile = path.join(profile, 'https.json');
  const httpsState = fs.existsSync(httpsFile) ? JSON.parse(fs.readFileSync(httpsFile, 'utf8')) : null;
  const base = configuredBase || (httpsState?.status === 'running' ? httpsState.publicBase : 'http://127.0.0.1:4110');
  const account = JSON.parse(fs.readFileSync(path.join(profile,'tai-khoan-demo.json'),'utf8')).sender;
  const state = JSON.parse(fs.readFileSync(path.join(profile,'trang-thai-demo.json'),'utf8'));
  await runPredictionBrowser(base, { account, artifactDir: path.join(profile,'prediction-qa'), oldGift: state.gift, revokedGift: state.revoked, expiredGift: state.expired });
}
