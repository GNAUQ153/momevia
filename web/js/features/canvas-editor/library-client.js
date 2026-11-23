import { installLibrary, libraryText } from '../../shared/canvas/library-state.js';
import { materializeModels } from '../../shared/canvas/library-materialize.js';
import { replaceCatalog } from './library.js';
import { installAudioCuration } from '../../shared/canvas/music-curation.js';

export function configureLibrary(snapshot, locale = 'vi') {
  installLibrary(snapshot);
  const groups = new Map();
  for (const row of snapshot.items.filter(r => r.kind === 'element' && r.status === 'active')) {
    const d = row.definition, group = libraryText(d.group, locale), title = libraryText(d.title, locale);
    if (!groups.has(group)) groups.set(group, { label: group, database: true, items: [] });
    groups.get(group).items.push({ id: row.id, title, group, keywords: libraryText(d.keywords, locale), database: true,
      create: () => materializeModels(d.elements) });
  }
  replaceCatalog([...groups.values()]);
}
export async function loadCanvasLibrary(api, locale = 'vi') {
  const { library, audioLibrary } = await api.get('/designs/library');
  installAudioCuration(audioLibrary);
  if (library) configureLibrary(library, locale);
  return library;
}
