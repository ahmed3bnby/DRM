export function normalizeName(value:string){return value.normalize('NFKC').toLowerCase().replace(/[ً-ٰٟـ]/g,'').replace(/[أإآٱ]/g,'ا').replace(/ى/g,'ي').replace(/[^\p{L}\p{N}]+/gu,' ').trim().replace(/\s+/g,' ');}

// Arabic letter → Latin phonetic. Tāʾ marbūṭa (ة) is silent: خليفة/فاطمة/حمزة are
// overwhelmingly romanised Khalifa/Fatima/Hamza.
// Lets a name written in Arabic and the same
// name written in Latin reduce to a comparable key for cross-script matching.
const AR2LAT:Record<string,string> = {'ء':'','آ':'a','أ':'a','ؤ':'w','إ':'a','ئ':'y','ا':'a','ب':'b','ة':'','ت':'t','ث':'th','ج':'j','ح':'h','خ':'kh','د':'d','ذ':'th','ر':'r','ز':'z','س':'s','ش':'sh','ص':'s','ض':'d','ط':'t','ظ':'z','ع':'a','غ':'gh','ف':'f','ق':'q','ك':'k','ل':'l','م':'m','ن':'n','ه':'h','و':'w','ي':'y','ى':'a'};

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
  const skel = (tok:string) => tok.replace(/(.)\1+/g,'$1')   // collapse doubled letters
    .replace(/[aeiouwy]/g,'');                                 // drop short vowels & semivowels → consonant skeleton
  return joinCompounds(s.split(/[^a-z]+/u).map(skel).filter(t => t.length >= 1)).join(' ').trim();
}

// Arabic compound names are written with or without spaces depending on script and
// transliterator: "نصر الله" / "Nasrallah" / "Nasr Allah", "عبد الكريم" / "Abd al-Karim" /
// "Abdulkarim", "أبو بكر" / "Abu Bakr" / "Abubakar", "الأسد" / "al-Assad". Joining the
// parts on the skeleton makes every spelling reduce to the same tokens.
function joinCompounds(tokens:string[]){
  const out:string[] = [];
  for (let i = 0; i < tokens.length; i++) {
    let t = tokens[i];
    // Prefixes that bind to the following name: article "al/el" (l), "abd" (bd), "abu" (b).
    while ((t === 'l' || t === 'bd' || t === 'b' || t === 'bdl') && i + 1 < tokens.length) t += tokens[++i];
    // "Allah" binds to the preceding name (Nasr Allah → Nasrallah, Abd Allah → Abdullah).
    if (t === 'lh' && out.length) { out[out.length - 1] += t; continue; }
    out.push(t);
  }
  return out.map(t => t.replace(/(.)\1+/g,'$1'));
}
