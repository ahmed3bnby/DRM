'use client';

import { useState } from 'react';
import {
  Building2,
  User,
  ShieldAlert,
  ShieldCheck,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Layers,
  Network,
  Globe2,
  AlertTriangle,
  KeyRound,
  Compass,
  FileSpreadsheet,
} from 'lucide-react';
import type { UboTreeData, UboEntityNode } from '@/lib/ubo-extractor';
import { countryName, flag } from '@/components/ui';
import type { Locale } from '@/lib/i18n';

interface Props {
  treeData: UboTreeData;
  locale?: Locale;
}

function NodeIcon({ category, type }: { category: UboEntityNode['category']; type: UboEntityNode['type'] }) {
  if (type === 'beneficial_owner') return <KeyRound size={15} className="text-emerald-500" />;
  if (category === 'offshore' || type === 'offshore_affiliate') return <AlertTriangle size={15} className="text-amber-500" />;
  if (category === 'individual') return <User size={15} className="text-sky-500" />;
  if (type === 'ultimate_parent') return <CrownIcon size={15} className="text-indigo-500" />;
  return <Building2 size={15} className="text-blue-500" />;
}

function CrownIcon({ size = 15, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.203a4 4 0 0 1-3.86 2.928H8.713a4 4 0 0 1-3.86-2.928L2.019 6.02a.5.5 0 0 1 .798-.52l4.277 3.665a1 1 0 0 0 1.516-.294z" />
      <path d="M5 21h14" />
    </svg>
  );
}

function UboTreeNodeComponent({
  node,
  depth = 0,
  isEn,
}: {
  node: UboEntityNode;
  depth?: number;
  isEn: boolean;
}) {
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  const nodeColorClass =
    node.type === 'target'
      ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-sm'
      : node.type === 'ultimate_parent'
      ? 'border-indigo-500 bg-indigo-50/40 dark:bg-indigo-950/20'
      : node.type === 'beneficial_owner'
      ? 'border-emerald-500 bg-emerald-50/40 dark:bg-emerald-950/20'
      : node.isOffshore
      ? 'border-amber-500 bg-amber-50/40 dark:bg-amber-950/20'
      : 'border-slate-300 bg-white dark:bg-slate-900';

  const badgeBg =
    node.type === 'target'
      ? 'bg-blue-600 text-white'
      : node.type === 'ultimate_parent'
      ? 'bg-indigo-600 text-white'
      : node.type === 'beneficial_owner'
      ? 'bg-emerald-600 text-white'
      : node.isOffshore
      ? 'bg-amber-600 text-white'
      : 'bg-slate-700 text-white';

  return (
    <div className="ubo-tree-branch relative flex flex-col items-start my-2">
      <div
        className={`ubo-tree-card relative flex items-center justify-between gap-3 p-3.5 rounded-lg border-2 transition-all ${nodeColorClass} hover:shadow-md w-full max-w-[620px]`}
        style={{
          borderLeftWidth: !isEn ? undefined : undefined,
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {hasChildren && (
            <button
              onClick={() => setExpanded(!expanded)}
              type="button"
              className="p-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
              title={expanded ? 'طي التفرع' : 'توسيع التفرع'}
            >
              {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>
          )}

          <div className="p-2 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-2xs shrink-0">
            <NodeIcon category={node.category} type={node.type} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h4 className="text-[13.5px] font-bold text-slate-900 dark:text-slate-100 truncate">
                {node.name}
              </h4>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${badgeBg}`}>
                {isEn ? node.roleLabelEn : node.roleLabelAr}
              </span>
              {node.ownershipPercent && (
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300">
                  {node.ownershipPercent}
                </span>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11.5px] text-slate-500 dark:text-slate-400 flex-wrap">
              {node.country && (
                <span className="flex items-center gap-1">
                  <span>{flag(node.country) || '🌐'}</span>
                  <span>{countryName(node.country, isEn ? 'en' : 'ar')}</span>
                </span>
              )}
              {node.lei && (
                <span className="font-mono text-[10.5px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                  LEI: {node.lei}
                </span>
              )}
              {node.registrationNumber && (
                <span className="font-mono text-[10.5px] bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">
                  REG: {node.registrationNumber}
                </span>
              )}
              {node.sourceNote && (
                <span className="text-[10.5px] text-slate-400 italic">
                  [{node.sourceNote}]
                </span>
              )}
            </div>
          </div>
        </div>

        {node.isOffshore && (
          <div className="shrink-0 flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/40 px-2 py-1 rounded border border-amber-300">
            <AlertTriangle size={13} />
            <span>{isEn ? 'Offshore' : 'ملاذ ضريبي'}</span>
          </div>
        )}
      </div>

      {/* Render Children Hierarchically */}
      {hasChildren && expanded && (
        <div className={`ubo-tree-children relative flex flex-col gap-2 ${isEn ? 'pl-8 border-l-2' : 'pr-8 border-r-2'} border-slate-300 dark:border-slate-700 my-2`}>
          {node.children!.map((child) => (
            <UboTreeNodeComponent key={child.id} node={child} depth={depth + 1} isEn={isEn} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function UboHierarchyTree({ treeData, locale = 'ar' }: Props) {
  const isEn = locale === 'en';

  return (
    <section className="ubo-hierarchy-container panel my-6 p-5 border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-sm">
      {/* Header Bar */}
      <div className="flex items-center justify-between flex-wrap gap-3 pb-4 mb-5 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 border border-indigo-200 dark:border-indigo-900">
            <Network size={20} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900 dark:text-white flex items-center gap-2">
              {isEn ? 'Interactive Corporate Hierarchy & UBO Structure' : 'هيكل الملكية وشجرة المستفيد الحقيقي التفاعلية (UBO)'}
              <span className="text-[10.5px] font-normal px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border border-blue-200">
                Level 2 GLEIF & Registries
              </span>
            </h3>
            <p className="text-[12px] text-slate-500 mt-0.5">
              {isEn
                ? 'Automated corporate ownership unbundling, ultimate holding identification & offshore exposure analysis'
                : 'تفكيك سلاسل الملكية المؤسسية، كشف الشركات الأم النهائية، والملاذات الضريبية وفق متطلبات وحدة المعلومات المالية'}
            </p>
          </div>
        </div>

        {/* Quick Stats Pills */}
        <div className="flex items-center gap-2 flex-wrap text-[11.5px]">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium">
            <Layers size={13} className="text-slate-500" />
            <span>{isEn ? 'Nodes:' : 'إجمالي الكيانات:'} <strong>{treeData.totalNodes}</strong></span>
          </div>

          {treeData.identifiedUbos.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 font-medium border border-emerald-200">
              <KeyRound size={13} className="text-emerald-600" />
              <span>{isEn ? 'Identified UBOs:' : 'المستفيدون الحقيقيون:'} <strong>{treeData.identifiedUbos.length}</strong></span>
            </div>
          )}

          {treeData.offshoreJurisdictions.length > 0 && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 font-medium border border-amber-200">
              <AlertTriangle size={13} className="text-amber-600" />
              <span>{isEn ? 'Offshore Links:' : 'ملاذات مرتبطة:'} <strong>{treeData.offshoreJurisdictions.join(', ')}</strong></span>
            </div>
          )}
        </div>
      </div>

      {/* Visual Hierarchy Tree */}
      <div className="ubo-tree-canvas p-4 bg-slate-50/50 dark:bg-slate-950/30 rounded-lg border border-slate-200 dark:border-slate-800 overflow-x-auto">
        <UboTreeNodeComponent node={treeData.rootEntity} isEn={isEn} />
        {!treeData.hasHierarchy && (
          <p className="mt-3 text-[12px] text-slate-500 dark:text-slate-400 border-t border-dashed border-slate-200 dark:border-slate-800 pt-3">
            {isEn
              ? 'No verified ownership or beneficial-owner data is available for this entity from the connected registries. Collect and record the UBO declaration (owners ≥ 25%) during customer due diligence.'
              : 'لا تتوفر بيانات ملكية أو مستفيد حقيقي مؤكّدة لهذا الكيان من السجلات المتصلة. يُرجى جمع وتوثيق إقرار المستفيد الحقيقي (مالك ≥ 25%) ضمن إجراءات العناية الواجبة.'}
          </p>
        )}
      </div>

      {/* Sources Footer Strip */}
      {treeData.sources.length > 0 && (
        <div className="flex items-center gap-2 pt-3 mt-4 text-[11.5px] text-slate-500 border-t border-slate-200 dark:border-slate-800">
          <Globe2 size={13} className="text-slate-400 shrink-0" />
          <span>{isEn ? 'Verified data sources for this entity structure:' : 'المصادر المعتمدة لهيكل هذا الكيان:'}</span>
          <div className="flex items-center gap-1.5 flex-wrap">
            {treeData.sources.map((src) => (
              <span key={src} className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-[10.5px]">
                {src}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
