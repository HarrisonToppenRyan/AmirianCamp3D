// story_pond.js: the Forest Pond has no story of its own yet (a quiet place north of the camp).
const V = new URL(import.meta.url).search;      // this file's own ?v=..., passed on so that no stale copy of what it imports is used
const { common } = await import('./story_common.js' + V);

export async function setup(S) {
  common(S);
  S.hint = async () => { await S.say('am', 0, 'A quiet pond. Nothing here wants to eat you, for once.\nThe way on is south of the camp.'); };
}
