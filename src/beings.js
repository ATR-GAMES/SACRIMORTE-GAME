// Whose throat is whose. f: speaking pitch (Hz); sc: vocal tract (bigger body < 1 < smaller); demon: how loud the
// inhuman layer under the voice is (the same cry slowed and darkened); sub: rough doubled pulses; chaos: unsteady
// pitch; breathy: more air; drive: grit; len: how long its cries last. say: what tools/voices.mjs renders for it.
const ALL = ['grunt', 'yelp', 'scream', 'choke', 'roar', 'death'];
export const BEINGS = {
  padre:       { f: 105, sc: 1, demon: 0, breathy: .3, chaos: .9, sub: .06,
                 say: ['grunt', 'yelp', 'scream', 'broken', 'groan', 'hup', 'effort', 'pant', 'rally', 'whisper', 'death'] },
  poseida:     { f: 215, sc: 1.12, demon: .35, chaos: 1.3, breathy: .4, say: ALL },
  poseido:     { f: 125, sc: 1, demon: .35, chaos: 1.3, sub: .1, say: ALL },
  carnicero:   { f: 88, sc: .86, demon: .55, sub: .2, drive: .5, len: 1.1, say: ALL },
  monja:       { f: 210, sc: 1.12, demon: .3, breathy: 1, say: [...ALL, 'hiss'] },
  acolito:     { f: 130, sc: 1, demon: .3, say: ALL },
  flagelante:  { f: 118, sc: .98, demon: .25, breathy: .3, say: [...ALL, 'moan'] },
  nino:        { f: 280, sc: 1.3, demon: .45, say: ALL },
  obispo:      { f: 78, sc: .85, demon: .6, sub: .25, len: 1.2, say: ALL },
  cabrio:      { f: 150, sc: .9, demon: .55, sub: .15, say: [...ALL, 'bleat'] },
  crucificado: { f: 98, sc: .92, demon: .35, breathy: .5, len: 1.2, say: [...ALL, 'moan'] },
  diablillo:   { f: 250, sc: 1.35, demon: .4, chaos: 1.5, say: ALL },
};
