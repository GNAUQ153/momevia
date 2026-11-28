// A group belongs to one scene. Its ID is the ID of one of its own layers,
// so the same ID map can rebind the whole group when a design or scene is copied.
export const ANCHORED_GROUP_LABEL='Momevia anchored composition v1';
export const ANCHORED_SURFACE_LABEL='Momevia composition reading surface v1';
export function groupElements(elements,{flow}={}) {
  if (elements.length > 1) {
    const anchor = elements.find(element => element.layout.rotation === 0) || elements[0];
    for (const element of elements) element.groupId = anchor.id;
    if(flow==='anchored')anchor.accessibility={...anchor.accessibility,decorative:true,label:ANCHORED_GROUP_LABEL};
  }
  return elements;
}

export function groupMembers(elements, element) {
  if (!element) return [];
  return element.groupId ? elements.filter(item => item.groupId === element.groupId) : [element];
}

// Used when deriving a new layout that intentionally omits some source layers.
export function repairElementGroups(elements) {
  const groups = new Map();
  for (const element of elements) {
    if (!element.groupId) continue;
    if (!groups.has(element.groupId)) groups.set(element.groupId, []);
    groups.get(element.groupId).push(element);
  }
  for (const [id, members] of groups) {
    if (members.length === 1) delete members[0].groupId;
    else if (!members.some(member => member.id === id)) groupElements(members);
  }
}
