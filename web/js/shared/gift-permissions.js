import { canonicalText } from './locale.js';

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

export function giftLinkDescriptionKeys(access, invited) {
  const { canOpen, canSend, canRead, replyAudience, repliesDisabled } = giftLinkPermissions(access, invited);
  if (!canOpen) return ['gift.share.rights.inviteOnly'];
  const send = repliesDisabled ? 'gift.share.rights.noSend' : canSend ? 'gift.share.rights.send' : 'gift.share.rights.inviteSend';
  const read = canRead ? 'gift.share.rights.read' : replyAudience === 'sender' ? 'gift.reply.senderAudience' : 'gift.share.rights.inviteRead';
  return ['gift.share.rights.open', send, read];
}

export function giftLinkDescription(access, invited) {
  return giftLinkDescriptionKeys(access, invited).map(key => canonicalText(key)).join(' ');
}
