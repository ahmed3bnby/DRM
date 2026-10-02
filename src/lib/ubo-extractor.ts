import type { Customer } from './customers';
import type { ScreeningMatchItem } from './screening';

export interface UboEntityNode {
  id: string;
  name: string;
  type: 'target' | 'ultimate_parent' | 'direct_parent' | 'beneficial_owner' | 'shareholder' | 'director' | 'offshore_affiliate' | 'subsidiary';
  category: 'company' | 'individual' | 'trust' | 'fund' | 'offshore';
  roleLabelAr: string;
  roleLabelEn: string;
  ownershipPercent?: number | string;
  country?: string;
  jurisdiction?: string;
  identifier?: string;
  lei?: string;
  registrationNumber?: string;
  isSanctioned?: boolean;
  isPep?: boolean;
  isOffshore?: boolean;
  isHighRisk?: boolean;
  sourceNote?: string;
  children?: UboEntityNode[];
}

export interface UboTreeData {
  hasHierarchy: boolean;
  rootEntity: UboEntityNode;
  totalNodes: number;
  maxDepth: number;
  identifiedUbos: string[];
  offshoreJurisdictions: string[];
  sources: string[];
}

/**
 * Parses percentage from string like "Tariq Al Mansoor (Beneficiary 60%)" or "Al Rayan Investment (80%)"
 */
function parseOwnershipPercent(str: string): string | undefined {
  const match = str.match(/(\d+(?:\.\d+)?)\s*%/);
  return match ? `${match[1]}%` : undefined;
}

/**
 * Cleans entity name removing bracketed roles / percentages
 */
function cleanEntityName(str: string): string {
  return str.replace(/\([^)]*\)/g, '').replace(/LEI:?\s*[\w\d]+/gi, '').trim();
}

/**
 * Classify a party name as a company when it carries a legal-entity suffix/keyword,
 * otherwise treat it as an individual. This is far more reliable than matching a fixed
 * list of first names.
 */
function looksLikeCompany(name: string): boolean {
  return /\b(l\.?l\.?c|ltd|limited|inc|corp|co|company|fz[ce]|fzco|llp|plc|holdings?|group|investments?|capital|trading|enterprises?|est|establishment|partners?|ventures?|trust|fund|sarl|gmbh|ag|sa|bv|pte)\b/i.test(name)
    || /ش\.?\s*ذ\.?\s*م\.?\s*م|شركة|مؤسسة|القابضة|للتجارة|للاستثمار|والشركاه|ذ\.?م\.?م/.test(name);
}

/**
 * Extracts UBO structure from customer profile and all screened matches.
 */
export function extractUboHierarchy(
  customer: Customer,
  topMatches: ScreeningMatchItem[] = [],
  rawDetailsList: Array<{ code: string; details: any }> = []
): UboTreeData {
  const isCompany = customer.entity_type === 'company';
  const identifiedUbos: string[] = [];
  const offshoreJurisdictions = new Set<string>();
  const sourcesUsed = new Set<string>();

  // Initialize Root Node (The Customer Entity)
  const rootNode: UboEntityNode = {
    id: `root-${customer.id}`,
    name: customer.name,
    type: 'target',
    category: isCompany ? 'company' : 'individual',
    roleLabelAr: isCompany ? 'الكيان محل الفحص والتدقيق' : 'العميل المستهدف (فرد)',
    roleLabelEn: isCompany ? 'Target Entity / Subject' : 'Target Individual / Subject',
    country: customer.country,
    identifier: customer.identifier || undefined,
    children: [],
  };

  // Find matches from GLEIF, OpenCorporates, Offshore Leaks
  const gleifMatches = topMatches.filter(m => m.code === 'gleif_lei_registry' || m.source?.toLowerCase().includes('gleif') || m.source?.toLowerCase().includes('lei'));
  const ocMatches = topMatches.filter(m => m.code === 'opencorporates_registry' || m.source?.toLowerCase().includes('opencorporates') || m.source?.toLowerCase().includes('corporate'));
  const offshoreMatches = topMatches.filter(m => m.code === 'icij_offshore_leaks' || m.source?.toLowerCase().includes('offshore') || m.source?.toLowerCase().includes('panama') || m.source?.toLowerCase().includes('paradise') || m.source?.toLowerCase().includes('pandora'));

  let hasHierarchy = false;

  // 1. Process GLEIF Matches (Level 2 Ownership: Ultimate & Direct Parents)
  for (const raw of rawDetailsList) {
    if (raw.code === 'gleif_lei_registry' && raw.details) {
      sourcesUsed.add('GLEIF LEI Golden Copy');
      const det = raw.details;
      if (det.lei) rootNode.lei = det.lei;

      // Ultimate Parent
      if (det.ultimateParent) {
        hasHierarchy = true;
        const parentName = cleanEntityName(det.ultimateParent);
        const parentLei = (det.ultimateParent.match(/LEI:?\s*([\w\d]+)/i) || [])[1];
        const isOffshoreParent = /cayman|bvi|virgin|jersey|guernsey|panama|seychelles|bermuda/i.test(det.ultimateParent);
        if (isOffshoreParent) offshoreJurisdictions.add('Offshore Parent / Trust');

        const ultimateNode: UboEntityNode = {
          id: `gleif-ult-${parentName}`,
          name: parentName,
          type: 'ultimate_parent',
          category: isOffshoreParent ? 'offshore' : 'company',
          roleLabelAr: 'الشركة الأم النهائية (Ultimate Parent)',
          roleLabelEn: 'Ultimate Parent Holding',
          lei: parentLei,
          isOffshore: isOffshoreParent,
          sourceNote: 'GLEIF Level 2 Ownership',
          children: [],
        };

        // Beneficial owners under ultimate parent if present
        if (Array.isArray(det.beneficialOwners)) {
          for (const bo of det.beneficialOwners) {
            const boName = cleanEntityName(bo);
            const pct = parseOwnershipPercent(bo);
            identifiedUbos.push(boName);
            ultimateNode.children?.push({
              id: `gleif-bo-${boName}`,
              name: boName,
              type: 'beneficial_owner',
              category: 'individual',
              roleLabelAr: 'مستفيد حقيقي نهائي (UBO)',
              roleLabelEn: 'Ultimate Beneficial Owner (UBO)',
              ownershipPercent: pct,
              sourceNote: 'GLEIF Golden Copy Registry',
            });
          }
        }

        // Direct Parent
        if (det.directParent && cleanEntityName(det.directParent) !== parentName) {
          const dirName = cleanEntityName(det.directParent);
          const directNode: UboEntityNode = {
            id: `gleif-dir-${dirName}`,
            name: dirName,
            type: 'direct_parent',
            category: 'company',
            roleLabelAr: 'الشركة الأم المباشرة (Direct Parent)',
            roleLabelEn: 'Direct Parent Company',
            sourceNote: 'GLEIF Corporate Linkage',
            children: [ultimateNode],
          };
          rootNode.children?.push(directNode);
        } else {
          rootNode.children?.push(ultimateNode);
        }
      }
    }
  }

  // 2. Process OpenCorporates Matches (Directors, Shareholders, Corporate Registries)
  for (const raw of rawDetailsList) {
    if (raw.code === 'opencorporates_registry' && raw.details) {
      sourcesUsed.add('OpenCorporates Registry');
      const det = raw.details;
      if (det.registrationNumber) rootNode.registrationNumber = det.registrationNumber;

      // Shareholders
      if (Array.isArray(det.shareholders)) {
        hasHierarchy = true;
        for (const sh of det.shareholders) {
          const shName = cleanEntityName(sh);
          const pct = parseOwnershipPercent(sh);
          const isIndividual = !looksLikeCompany(shName);
          if (pct && parseInt(pct, 10) >= 25) {
            identifiedUbos.push(shName);
          }
          rootNode.children?.push({
            id: `oc-sh-${shName}`,
            name: shName,
            type: 'shareholder',
            category: isIndividual ? 'individual' : 'company',
            roleLabelAr: isIndividual ? `مساهم رئيسي (${pct || 'حصة ملكية'})` : `شركة مساهمة (${pct || 'حصة ملكية'})`,
            roleLabelEn: `Major Shareholder (${pct || 'Equity'})`,
            ownershipPercent: pct,
            jurisdiction: det.jurisdiction,
            sourceNote: det.corporateRegistry || 'Corporate Registry',
          });
        }
      }

      // Directors / Managing Partners
      if (Array.isArray(det.directors)) {
        for (const dir of det.directors) {
          const dirName = cleanEntityName(dir);
          rootNode.children?.push({
            id: `oc-dir-${dirName}`,
            name: dirName,
            type: 'director',
            category: 'individual',
            roleLabelAr: 'مدير تنفيذي / مفوض بالتوقيع',
            roleLabelEn: 'Director / Authorized Signatory',
            sourceNote: det.corporateRegistry || 'Corporate Registry',
          });
        }
      }

      // Ultimate Beneficial Owner from OpenCorporates
      if (det.beneficialOwner) {
        hasHierarchy = true;
        const boName = cleanEntityName(det.beneficialOwner);
        identifiedUbos.push(boName);
        rootNode.children?.push({
          id: `oc-bo-${boName}`,
          name: boName,
          type: 'beneficial_owner',
          category: 'trust',
          roleLabelAr: 'صندوق ائتماني / مستفيد حقيقي',
          roleLabelEn: 'Beneficial Owner / Trust',
          country: Array.isArray(det.country) ? det.country[0] : (det.country || undefined),
          sourceNote: 'OpenCorporates Registry',
        });
      }
    }
  }

  // 3. Process Offshore Leaks Matches (Shell Companies & Intermediaries)
  for (const raw of rawDetailsList) {
    if (raw.code === 'icij_offshore_leaks' && raw.details) {
      sourcesUsed.add('ICIJ Offshore Leaks Database');
      hasHierarchy = true;
      const det = raw.details;
      const juris = det.jurisdiction || 'Offshore Haven';
      offshoreJurisdictions.add(juris);

      const leakNode: UboEntityNode = {
        id: `leaks-${raw.details.leakSource || 'panama'}-${rootNode.id}`,
        name: `${det.leakSource || 'Offshore Haven'} Linkage`,
        type: 'offshore_affiliate',
        category: 'offshore',
        roleLabelAr: `ملاذ ضريبي / تسريبات (${juris.toUpperCase()})`,
        roleLabelEn: `Offshore Jurisdiction (${juris.toUpperCase()})`,
        isOffshore: true,
        isHighRisk: true,
        sourceNote: det.leakSource || 'Panama / Pandora Papers',
        children: [],
      };

      if (Array.isArray(det.officers)) {
        for (const off of det.officers) {
          const offName = cleanEntityName(off);
          const pct = parseOwnershipPercent(off);
          identifiedUbos.push(offName);
          leakNode.children?.push({
            id: `leaks-off-${offName}`,
            name: offName,
            type: 'beneficial_owner',
            category: 'individual',
            roleLabelAr: 'مستفيد / مالك أسهم مسجل بالخارج',
            roleLabelEn: 'Offshore Shareholder / Beneficial Owner',
            ownershipPercent: pct,
            isOffshore: true,
            isHighRisk: true,
            sourceNote: det.leakSource || 'ICIJ Offshore Leaks',
          });
        }
      }

      if (Array.isArray(det.connectedEntities)) {
        for (const conn of det.connectedEntities) {
          const connName = cleanEntityName(conn);
          leakNode.children?.push({
            id: `leaks-conn-${connName}`,
            name: connName,
            type: 'offshore_affiliate',
            category: 'company',
            roleLabelAr: 'كيان وهمي مرتبط (Shell Company)',
            roleLabelEn: 'Connected Shell Entity',
            isOffshore: true,
            isHighRisk: true,
            sourceNote: 'ICIJ Offshore Leaks Network',
          });
        }
      }

      rootNode.children?.push(leakNode);
    }
  }

  // No fabrication: when the registries return no ownership/UBO data we leave the
  // tree with only the target entity (hasHierarchy stays false) so the UI can show
  // an honest "no verified ownership data" state. Never invent owners/percentages —
  // this is compliance evidence, not a demo placeholder.

  // Calculate stats
  let totalNodes = 1;
  let maxDepth = 1;

  function countTree(node: UboEntityNode, depth: number) {
    if (depth > maxDepth) maxDepth = depth;
    if (node.children && node.children.length > 0) {
      for (const child of node.children) {
        totalNodes++;
        countTree(child, depth + 1);
      }
    }
  }

  countTree(rootNode, 1);

  return {
    hasHierarchy,
    rootEntity: rootNode,
    totalNodes,
    maxDepth,
    identifiedUbos: Array.from(new Set(identifiedUbos)),
    offshoreJurisdictions: Array.from(offshoreJurisdictions),
    sources: Array.from(sourcesUsed),
  };
}
