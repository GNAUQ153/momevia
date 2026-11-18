export function mountInbox(dialog, { replies, renderReplies, markRead, onUnreadCount }) {
  const list = dialog.querySelector('.reply-list');
  const filter = dialog.querySelector('.inbox-filter input');
  const status = dialog.querySelector('.inbox-status');
  const seen = new Set();
  let saving = false;
  async function markVisible() {
    if (saving || !seen.size) return;
    saving = true;
    const ids = [...seen].slice(0, 100);
    ids.forEach(id => seen.delete(id));
    try {
      const { unreadCount } = await markRead(ids);
      for (const reply of replies) if (ids.includes(reply.id)) reply.unread = false;
      onUnreadCount(unreadCount);
      if (dialog.isConnected) status.textContent = unreadCount ? `${unreadCount} lời đáp chưa đọc` : '';
    } catch {
      if (dialog.isConnected) status.textContent = 'Chưa ghi nhận đã đọc. Mở lại hộp thư để thử lại.';
    } finally {
      saving = false;
      if (dialog.isConnected && seen.size) void markVisible();
    }
  }
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (document.hidden || !entry.isIntersecting || entry.intersectionRatio < .15) continue;
      observer.unobserve(entry.target);
      seen.add(entry.target.dataset.unreadReply);
    }
    void markVisible();
  }, { root: dialog, threshold: .15 });
  function show() {
    observer.disconnect();
    const visible = filter.checked ? replies.filter(reply => reply.unread) : replies;
    list.innerHTML = visible.length ? renderReplies(visible, true)
      : `<p>${filter.checked ? 'Không có lời đáp chưa đọc.' : 'Lời đáp cho món quà này sẽ xuất hiện ở đây.'}</p>`;
    list.querySelectorAll('[data-unread-reply]').forEach(item => observer.observe(item));
  }
  filter.addEventListener('change', show);
  const onVisibility = () => { if (!document.hidden && dialog.isConnected) show(); };
  document.addEventListener('visibilitychange', onVisibility);
  show();
  return () => {
    observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
  };
}
