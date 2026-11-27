import { NATURAL_ARTWORK_LABEL } from '../../shared/canvas/event-media.js';

// One measurement contract for the live scene and the scene beneath opening doors.
export function reflowSceneNodes(nodes, scale, stageTop) {
  const content = nodes.filter(({ model }) => !['shape', 'line', 'sticker'].includes(model.type)
    && !(model.type === 'image' && model.accessibility.decorative && model.accessibility.label === NATURAL_ARTWORK_LABEL))
    .sort((a, b) => a.model.layout.y - b.model.layout.y);
  const cohorts = [];
  for (const item of content) {
    const { y, height } = item.model.layout, previous = cohorts.at(-1);
    if (previous && y < previous.logicalEnd) {
      previous.items.push(item); previous.logicalEnd = Math.max(previous.logicalEnd, y + height);
    } else cohorts.push({ items: [item], logicalEnd: y + height });
  }
  let shift = 0, actualEnd = 0, intrinsicReply = false;
  for (const cohort of cohorts) {
    let bottom = -Infinity;
    for (const { model, node } of cohort.items) {
      node.style.top = `${model.layout.y * scale + shift}px`;
      bottom = Math.max(bottom, node.getBoundingClientRect().bottom - stageTop);
    }
    const intrinsic = cohort.items.some(({ model }) => model.type === 'reply' && model.props.replyMode === 'attendance');
    intrinsicReply ||= intrinsic;
    const delta = bottom - (cohort.logicalEnd * scale + shift);
    actualEnd = Math.max(actualEnd, bottom);
    shift += intrinsic ? delta : Math.max(0, delta);
  }
  return { actualEnd, intrinsicReply };
}
