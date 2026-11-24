// Không phản hồi (null) khác với lựa chọn chưa quyết định (tentative).
export const RSVP_STATUSES = Object.freeze(['attending', 'declined', 'tentative']);
export const isRsvpStatus = value => RSVP_STATUSES.includes(value);

export function rsvpCounts(recipients) {
  const counts = { attending: 0, declined: 0, tentative: 0, unanswered: 0 };
  for (const recipient of recipients) {
    const status = recipient.rsvp?.status;
    counts[isRsvpStatus(status) ? status : 'unanswered']++;
  }
  return counts;
}
