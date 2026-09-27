import { readFile } from 'node:fs/promises';
import path from 'node:path';
import defaultCatalog from '@/data/source-catalog.json';

// NOTE: `band` here is SCREENING-MATCH SEVERITY (شدّة المطابقة) — how strong/serious a
// source hit is — NOT the customer's final risk rating. Per the plan's principle #3,
// match score, analyst determination, and customer risk rating stay three separate things;
// the final risk rating is owned by the P06 risk model + analyst, never auto-set from a name.
export type Category = 'sanctions'|'debarment'|'crime'|'regulatory'|'pep'|'other';
export type RiskBand = 'high'|'medium'|'low';

// Category comes from the OpenSanctions collection a list belongs to (data-driven, in the
// catalog). Legacy direct-connector codes are mapped explicitly.
const LEGACY:Record<string,Category> = {
  UN:'sanctions',UK:'sanctions',OFAC:'sanctions',CSL:'sanctions',EU:'sanctions',UAE:'sanctions',
  ae_local_terrorists:'sanctions', sa_pcct_terrorism_list:'sanctions', us_ofac_sdn:'sanctions',
  us_ofac_cons:'sanctions', un_sc_sanctions:'sanctions', eu_fsf:'sanctions',
  gb_fcdo_sanctions:'sanctions', ch_seco_sanctions:'sanctions', us_trade_csl:'sanctions',
  eg_terrorists:'sanctions', pk_proscribed_persons:'sanctions',
  interpol_red_notices:'crime', ae_dfsa_prohibited:'crime',
  worldbank_debarred:'debarment', us_cia_world_leaders:'pep',
  eg_house_representatives:'pep', qa_shura_council:'pep', bh_nuwab:'pep', om_parliament:'pep'
};
export const CATEGORY_LABEL:Record<Category,string> = {
  sanctions:'عقوبات', debarment:'حظر تعاقد', crime:'جريمة / إنفاذ',
  regulatory:'إجراء رقابي', pep:'شخصية سياسية (PEP)', other:'قائمة مراقبة',
};
export const BAND_LABEL:Record<RiskBand,string> = {high:'مرتفع', medium:'متوسط', low:'منخفض'};

export type CatalogMeta = {category:Category;title:string;country?:string};

const BUNDLED_MAP: Record<string, CatalogMeta> = Object.fromEntries(
  (defaultCatalog.sources as Array<{code:string;category:Category;title:string;country?:string}>).map(s => [
    s.code,
    { category: s.category as Category, title: s.title, country: s.country }
  ])
);

export async function loadCategories():Promise<Record<string,CatalogMeta>> {
  try {
    const cat=JSON.parse(await readFile(path.join(process.cwd(),'.local/sources/_catalog.json'),'utf8'));
    const diskMap = Object.fromEntries(cat.sources.map((s:{code:string;category:Category;title:string;country?:string})=>[s.code,{category:s.category,title:s.title,country:s.country}]));
    return { ...BUNDLED_MAP, ...diskMap };
  } catch {
    return BUNDLED_MAP;
  }
}
export function categoryOf(code:string, map:Record<string,CatalogMeta>):Category {
  return map[code]?.category ?? LEGACY[code] ?? 'other';
}

// PEP tiering & RCA (Phase 2). Data-driven from OpenSanctions `topics` (role.pep / role.rca) plus a
// transparent seniority heuristic over the position text and the source list. Tier is an aid for the
// analyst, never an automatic customer risk rating.
export type PepTier = 1|2|3;
export type PepProfile = { isPep:boolean; isRca:boolean; tier:PepTier|null };
const TIER1_POS = /president|prime minister|minister|head of state|head of government|senator|ambassador|governor|central bank|supreme court|chief justice|attorney general|commander|member of parliament|national assembly|member of the national|world leader|cabinet|secretary of state|speaker/i;
const TIER2_POS = /regional|provincial|state parliament|mayor|municipal|local council|legislative assembly|governorate|deputy governor|county|district/i;
const TIER1_CODE = /cia_world_leaders|_na_members|_senate|_meps|world_leaders/i;
export function pepProfile(details:Record<string,unknown>|undefined, code=''):PepProfile {
  const topics = Array.isArray(details?.topics) ? (details!.topics as string[]) : [];
  const isRca = topics.includes('role.rca');
  const isPep = topics.some(t=>t==='role.pep'||t.startsWith('role.pep.'));
  if (!isPep && !isRca) return {isPep:false, isRca:false, tier:null};
  const positions = ([] as string[]).concat(
    Array.isArray(details?.position)?details!.position as string[]:[],
    Array.isArray(details?.positionOccupancies)?details!.positionOccupancies as string[]:[],
  ).join(' · ');
  let tier:PepTier = 3;
  if (TIER1_CODE.test(code) || TIER1_POS.test(positions)) tier = 1;
  else if (TIER2_POS.test(positions)) tier = 2;
  return {isPep, isRca, tier: isPep ? tier : null};
}

// A single source hit, classified.
export type ClassifiedMatch = {
  category:Category; categoryLabel:string; sourceTitle:string;
  band:RiskBand; bandLabel:string; percent:number; strong:boolean;
  pepTier:PepTier|null; isRca:boolean;
};
export function classifyMatch(code:string, matchKind:string, similarity:number, map:Record<string,CatalogMeta>, opts?:{strongId?:boolean; demote?:boolean; details?:Record<string,unknown>}):ClassifiedMatch {
  const category=categoryOf(code,map);
  const sim=matchKind==='exact'?1:Math.max(0,Math.min(1,similarity));
  // A matching date of birth or identifier is strong identity confirmation; it lifts even a weak
  // name match to a strong hit — unless a hard identifier (e.g. birth year) actively conflicts.
  const boosted=!!opts?.strongId && !opts?.demote;
  const strong=boosted||matchKind==='exact'||sim>=0.85;
  const moderate=!strong&&sim>=0.80;
  let band:RiskBand;
  if (category==='sanctions'||category==='debarment'||category==='crime')
    band = strong?'high':moderate?'medium':'low';           // enforcement severity scales with match strength
  else if (category==='pep'||category==='regulatory')
    band = (strong||moderate)?'medium':'low';               // elevated, never auto-high on name alone
  else
    band = 'low';
  // A contradicting identity signal (e.g. different birth year) lowers confidence one step — but the
  // candidate stays visible for the analyst; we never silently suppress a name match.
  if (opts?.demote) band = band==='high'?'medium':'low';
  const pep = pepProfile(opts?.details, code);
  return {category, categoryLabel:CATEGORY_LABEL[category], sourceTitle:map[code]?.title??code,
    band, bandLabel:BAND_LABEL[band], percent:Math.round(sim*100), strong,
    pepTier:pep.tier, isRca:pep.isRca};
}

// Person-level determination across all hits.
export type Assessment = {
  band:RiskBand|'none'; bandLabel:string; determination:string;
  flags:{sanctions:boolean; pep:boolean; debarment:boolean; crime:boolean; regulatory:boolean};
  total:number; relevant:number;
};
const RANK:Record<RiskBand,number> = {low:1, medium:2, high:3};
export function assess(matches:ClassifiedMatch[]):Assessment {
  const flags={sanctions:false,pep:false,debarment:false,crime:false,regulatory:false};
  let top:RiskBand|null=null, relevant=0;
  for (const m of matches) {
    if (m.band!=='low') relevant++;
    if (m.band!=='low' && m.category in flags) (flags as Record<string,boolean>)[m.category]=true;
    if (!top || RANK[m.band]>RANK[top]) top=m.band;
  }
  if (!matches.length || !top) return {band:'none',bandLabel:'لا مطابقات',determination:'لا مطابقات ذات صلة — تقييم مخاطر العميل قرار للمحلل',flags,total:0,relevant:0};
  const parts:string[]=[];
  if (flags.sanctions) parts.push('عقوبات');
  if (flags.debarment) parts.push('حظر تعاقد');
  if (flags.crime) parts.push('إنفاذ/جريمة');
  if (flags.pep) parts.push('PEP');
  if (flags.regulatory) parts.push('إجراء رقابي');
  const kinds=parts.length?parts.join(' · '):'تشابه اسم';
  return {band:top, bandLabel:BAND_LABEL[top],
    determination:`${kinds} — شدّة مطابقة ${BAND_LABEL[top]} · تقييم مخاطر العميل قرار للمحلل`,
    flags, total:matches.length, relevant};
}
