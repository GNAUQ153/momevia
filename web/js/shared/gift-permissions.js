export function giftLinkPermissions(access, invited) {
  const { open = 'link', send = 'link', read = 'link' } = access || {};
  const canOpen = open === 'link' || invited;
  return {
    canOpen,
    canSend: canOpen && (send === 'link' || (send === 'invite' && invited)),
    canRead: canOpen && (read === 'link' || (read === 'invite' && invited)),
    replyAudience: read === 'link' && open === 'link' ? 'link' : read === 'sender' ? 'sender' : 'invite',
    repliesDisabled: send === 'disabled',
  };
}

export function giftLinkDescription(access, invited) {
  const { canOpen, canSend, canRead, replyAudience, repliesDisabled } = giftLinkPermissions(access, invited);
  if (!canOpen) return 'Cần link mời để mở quà, gửi hoặc đọc lời đáp.';
  const send = repliesDisabled ? 'Đã tắt gửi lời đáp.' : canSend ? 'Gửi được lời đáp.' : 'Cần link mời để gửi lời đáp.';
  const read = canRead ? 'Đọc được lời đáp.' : replyAudience === 'sender' ? 'Chỉ người gửi quà đọc được lời đáp.' : 'Cần link mời để đọc lời đáp.';
  return `Mở được quà. ${send} ${read}`;
}
