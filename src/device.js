// PC or phone. Phones get the touch controls and the lighter mode (paint only what is needed, fewer blood drops,
// smaller slices of work per frame). Force either with ?modo=movil or ?modo=pc in the address.
const q = new URLSearchParams(location.search).get('modo');
const ua = navigator.userAgent || '';
const phoneUA = /Android|iPhone|iPod|iPad|Mobile|Silk|Kindle|Opera Mini/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
const coarse = matchMedia('(pointer: coarse)').matches && matchMedia('(hover: none)').matches;
export const MOBILE = q === 'movil' || q === 'mobile' ? true : q === 'pc' ? false : phoneUA || coarse;
// How much work may happen in one frame, and how much blood.
export const PERF = MOBILE
  ? { bakeBudget: 6, goreBudget: 3, prefetch: false, blood: .5, splats: 1500 }
  : { bakeBudget: 14, goreBudget: 6, prefetch: true, blood: 1, splats: 5000 };
