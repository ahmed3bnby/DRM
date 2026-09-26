export function normalizeName(value:string){return value.normalize('NFKC').toLowerCase().replace(/[ً-ٰٟـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}

// Arabic letter → Latin phonetic. Lets a name written in Arabic and the same
// name written in Latin reduce to a comparable key for cross-script matching.
const AR2LAT:Record<string,string> = {'ء':'','آ':'a','أ':'a','ؤ':'w','إ':'a','ئ':'y','ا':'a','ب':'b','ة':'h','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh','د':'d','ذ':'th','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','و':'w','ي':'y','ى':'a'};

// Unified cross-script phonetic key: transliterate Arabic → Latin, then reduce
// each token to a consonant skeleton (short vowels and semivowels dropped) so
// "Taher"/"طاهر" and "Mohamed"/"محمد" collapse to the same key. Used as an
// ADDITIONAL match signal alongside normalizeName, never a replacement — it
// widens recall across Arabic/Latin without changing same-script behaviour.
export function phoneticKey(value:string){
  let s = value.normalize('NFKC').toLowerCase()
    .replace(/[ً-ٰٟـ]/g,'')
    .replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي');
  s = [...s].map(ch => ch in AR2LAT ? AR2LAT[ch] : ch).join('');
  return s.split(/[^a-z]+/u).map(tok =>
    tok.replace(/(.)\1+/g,'$1')   // collapse doubled letters
       .replace(/[aeiouwy]/g,'')  // drop short vowels & semivowels → consonant skeleton
  ).filter(t => t.length >= 1).join(' ').trim();
}
