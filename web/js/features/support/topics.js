import { text } from '../../core/i18n.js';
import { canonicalText } from '../../shared/locale.js';

export const supportTopics = ['account', 'gifts', 'catalog', 'bug', 'other'];
export const topicKey = id => `support.topic.${id}`;
export const topicForRequest = id => [...supportTopics, 'report'].includes(id) ? canonicalText(topicKey(id)) : id;

export function storedTopicText(value) {
  const id = [...supportTopics, 'report'].find(topic => topicForRequest(topic) === value);
  return id ? text(topicKey(id)) : undefined;
}
