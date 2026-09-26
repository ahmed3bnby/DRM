import {
  detailLabel,
  detailGroup,
  safeSourceUrl,
  formatDetailValue,
  type GroupKey
} from '@/lib/record-details';
import type { Locale, Messages } from '@/lib/i18n';
import {
  UserCheck,
  ShieldAlert,
  MapPin,
  Network,
  Languages,
  Database,
  ExternalLink,
  ChevronDown,
  FileText,
  Info
} from 'lucide-react';

function formatUrlLabel(url: string): string {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    const path = parsed.pathname !== '/' ? parsed.pathname : '';
    const short = host + (path.length > 28 ? path.slice(0, 25) + '…' : path);
    return short;
  } catch {
    return url;
  }
}

function GroupIcon({ group }: { group: GroupKey }) {
  switch (group) {
    case 'identity':
      return <UserCheck size={18} className="group-icon" aria-hidden="true" />;
    case 'listing':
      return <ShieldAlert size={18} className="group-icon" aria-hidden="true" />;
    case 'addresses':
      return <MapPin size={18} className="group-icon" aria-hidden="true" />;
    case 'relations':
      return <Network size={18} className="group-icon" aria-hidden="true" />;
    default:
      return <FileText size={18} className="group-icon" aria-hidden="true" />;
  }
}

function isComplexValue(val: unknown): boolean {
  if (Array.isArray(val)) {
    if (val.length === 0) return false;
    if (typeof val[0] === 'object' && val[0] !== null) return true;
    return false;
  }
  if (typeof val === 'object' && val !== null) {
    const o = val as Record<string, unknown>;
    if (o.properties && typeof o.properties === 'object') return true;
    return Object.keys(o).length > 2;
  }
  if (typeof val === 'string' && val.length > 80) return true;
  return false;
}

function Value({
  value,
  depth = 0,
  valueKey = '',
  admin = false,
  m,
  locale
}: {
  value: unknown;
  depth?: number;
  valueKey?: string;
  admin?: boolean;
  m: Messages;
  locale: Locale;
}) {
  if (value === null || value === undefined || value === '') {
    return <span className="not-run">{m.recNotAvail}</span>;
  }

  if (Array.isArray(value)) {
    // If it's an array of objects (like multiple sanctions or addresses)
    if (value.length > 0 && typeof value[0] === 'object' && value[0] !== null) {
      return (
        <div className="relation-cards-stack">
          {value.map((v, i) => (
            <Value key={i} value={v} depth={depth} valueKey={valueKey} admin={admin} m={m} locale={locale} />
          ))}
        </div>
      );
    }

    // Array of scalar values (e.g. multiple names, topics, or countries)
    return (
      <div className="scalar-values-stack">
        {value.map((v, i) => (
          <div className="scalar-value-item" key={i}>
            <Value value={v} depth={depth} valueKey={valueKey} admin={admin} m={m} locale={locale} />
          </div>
        ))}
      </div>
    );
  }

  if (typeof value === 'object') {
    const o = value as Record<string, unknown>;

    if (depth >= 5) {
      return (
        <details className="raw-json-details">
          <summary>{m.recExtraDetails}</summary>
          <pre dir="auto" style={{ whiteSpace: 'pre-wrap' }}>
            {JSON.stringify(o, null, 2)}
          </pre>
        </details>
      );
    }

    // Relation item with .properties (Sanctions, Address, Directorship, etc.)
    if (o.properties && typeof o.properties === 'object') {
      const schemaLabel = o.schema ? formatDetailValue('schema', String(o.schema), locale) : '';
      const title = String(o.caption || schemaLabel || m.recLinkedRecord);
      const datasets = Array.isArray(o.datasets) ? o.datasets : [];

      return (
        <details className="record-relation-card" open>
          <summary className="relation-card-head" dir="auto">
            <span className="relation-chevron" aria-hidden="true">
              <ChevronDown size={15} />
            </span>
            <strong className="relation-title">{title}</strong>
            {schemaLabel && <span className="relation-schema-tag">{schemaLabel}</span>}
          </summary>
          <div className="relation-card-body">
            <dl className="relation-props-grid">
              {Object.entries(o.properties as Record<string, unknown>)
                .filter(([, propVal]) => propVal != null && propVal !== '')
                .map(([propKey, propVal]) => (
                  <div key={propKey} className="relation-prop-item">
                    <dt>{detailLabel(propKey, locale)}</dt>
                    <dd>
                      <Value
                        value={propVal}
                        depth={depth + 1}
                        valueKey={propKey}
                        admin={admin}
                        m={m}
                        locale={locale}
                      />
                    </dd>
                  </div>
                ))}
            </dl>
            {admin && datasets.length > 0 && (
              <div className="relation-datasets-row">
                <span className="dataset-label">{m.recContribLists}</span>
                <div className="dataset-badges">
                  {datasets.map((ds, idx) => (
                    <span key={idx} className="dataset-badge mono">
                      {String(ds)}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </details>
      );
    }

    // Standard nested object map
    return (
      <dl className="nested-props-grid">
        {Object.entries(o)
          .filter(([, v]) => v != null && v !== '')
          .map(([k, v]) => (
            <div key={k} className="nested-prop-item">
              <dt>{detailLabel(k, locale)}</dt>
              <dd>
                <Value value={v} depth={depth + 1} valueKey={k} admin={admin} m={m} locale={locale} />
              </dd>
            </div>
          ))}
      </dl>
    );
  }

  // Scalar value (string, number, boolean)
  const link = safeSourceUrl(value);
  if (link) {
    if (admin) {
      return (
        <a
          href={link}
          target="_blank"
          rel="noopener noreferrer"
          className="source-link-chip"
          title={link}
          dir="ltr"
        >
          <span>{formatUrlLabel(link)}</span>
          <ExternalLink size={12} aria-hidden="true" />
        </a>
      );
    }
    return <span className="muted">{m.recLinkAdmin}</span>;
  }

  const display = typeof value === 'string' ? formatDetailValue(valueKey, value, locale) : String(value);
  return <span dir="auto">{display}</span>;
}

function ProvenanceCard({
  provenance,
  m,
  locale
}: {
  provenance: Record<string, unknown>;
  m: Messages;
  locale: Locale;
}) {
  const schema = String(provenance.schema || 'Record');
  const provider = String(provenance.provider || 'OpenSanctions');
  const firstSeen = provenance.firstSeen ? formatDetailValue('firstSeen', String(provenance.firstSeen), locale) : null;
  const lastSeen = provenance.lastSeen ? formatDetailValue('lastSeen', String(provenance.lastSeen), locale) : null;
  const lastChange = provenance.lastChange ? formatDetailValue('lastChange', String(provenance.lastChange), locale) : null;
  const publisher = provenance.publisher ? String(provenance.publisher) : null;
  const version = provenance.upstreamVersion ? String(provenance.upstreamVersion) : null;
  const officialUrl = safeSourceUrl(provenance.officialUrl);
  const datasets = Array.isArray(provenance.datasets) ? provenance.datasets : [];
  const referents = Array.isArray(provenance.referents) ? provenance.referents : [];

  return (
    <section className="panel source-section-panel provenance-panel">
      <div className="panel-heading">
        <h2>
          <Database size={18} className="group-icon" aria-hidden="true" />
          <span>{m.recProvenance}</span>
        </h2>
        <span className="admin-only">{m.recForAdmin}</span>
      </div>
      <div className="provenance-body">
        {/* Quick Audit Metrics */}
        <div className="provenance-metrics-row">
          <div className="prov-metric">
            <span className="prov-metric-label">{detailLabel('schema', locale)}</span>
            <strong className="prov-metric-value">{formatDetailValue('schema', schema, locale)}</strong>
          </div>
          <div className="prov-metric">
            <span className="prov-metric-label">{detailLabel('provider', locale)}</span>
            <strong className="prov-metric-value">{provider}</strong>
          </div>
          {firstSeen && (
            <div className="prov-metric">
              <span className="prov-metric-label">{detailLabel('firstSeen', locale)}</span>
              <strong className="prov-metric-value">{firstSeen}</strong>
            </div>
          )}
          {lastSeen && (
            <div className="prov-metric">
              <span className="prov-metric-label">{detailLabel('lastSeen', locale)}</span>
              <strong className="prov-metric-value">{lastSeen}</strong>
            </div>
          )}
        </div>

        {/* Detailed Audit Grid */}
        <div className="provenance-details-grid">
          {publisher && (
            <div className="prov-detail-item">
              <span className="prov-detail-label">{detailLabel('publisher', locale)}</span>
              <span className="prov-detail-value">{publisher}</span>
            </div>
          )}
          {lastChange && (
            <div className="prov-detail-item">
              <span className="prov-detail-label">{detailLabel('lastChange', locale)}</span>
              <span className="prov-detail-value">{lastChange}</span>
            </div>
          )}
          {version && (
            <div className="prov-detail-item">
              <span className="prov-detail-label">{detailLabel('upstreamVersion', locale)}</span>
              <span className="prov-detail-value mono">{version}</span>
            </div>
          )}
          {officialUrl && (
            <div className="prov-detail-item">
              <span className="prov-detail-label">{detailLabel('officialUrl', locale)}</span>
              <a href={officialUrl} target="_blank" rel="noopener noreferrer" className="source-link-chip" dir="ltr">
                <span>{formatUrlLabel(officialUrl)}</span>
                <ExternalLink size={12} aria-hidden="true" />
              </a>
            </div>
          )}
          {datasets.length > 0 && (
            <div className="prov-detail-item full-width">
              <span className="prov-detail-label">{detailLabel('datasets', locale)}</span>
              <div className="dataset-badges">
                {datasets.map((d, i) => (
                  <span key={i} className="dataset-badge mono">
                    {String(d)}
                  </span>
                ))}
              </div>
            </div>
          )}
          {referents.length > 0 && (
            <div className="prov-detail-item full-width">
              <span className="prov-detail-label">{detailLabel('referents', locale)}</span>
              <div className="referents-list">
                {referents.map((ref, i) => (
                  <span key={i} className="referent-chip mono" title={String(ref)}>
                    {String(ref)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Note Callout */}
        <div className="provenance-note-box">
          <Info size={16} aria-hidden="true" />
          <p>{m.recProvenanceNote}</p>
        </div>
      </div>
    </section>
  );
}

export function SourceRecordDetails({
  details,
  aliases,
  isAdmin = false,
  m,
  locale
}: {
  details: Record<string, unknown>;
  aliases: string[];
  isAdmin?: boolean;
  m: Messages;
  locale: Locale;
}) {
  const groupLabel: Record<GroupKey, string> = {
    identity: m.grpIdentity,
    listing: m.grpListing,
    addresses: m.grpAddresses,
    relations: m.grpRelations
  };

  const groups = new Map<GroupKey, [string, unknown][]>();
  // Pre-seed groups in logical order
  const groupOrder: GroupKey[] = ['identity', 'listing', 'addresses', 'relations'];
  for (const g of groupOrder) {
    groups.set(g, []);
  }

  const detailsObj = details && typeof details === 'object' ? details : {};
  const aliasesArr = Array.isArray(aliases) ? aliases : [];

  for (const [key, v] of Object.entries(detailsObj)) {
    if (key.startsWith('_') || v == null || (Array.isArray(v) && !v.length)) continue;
    const g = detailGroup(key);
    groups.set(g, [...(groups.get(g) || []), [key, v]]);
  }

  // Filter out empty groups
  const activeGroups = groupOrder.filter((g) => (groups.get(g)?.length || 0) > 0);

  return (
    <>
      {/* Aliases Card (if any) */}
      {aliasesArr.length > 0 && (
        <section className="panel source-section-panel aliases-panel">
          <div className="panel-heading">
            <h2>
              <Languages size={18} className="group-icon" aria-hidden="true" />
              <span>{m.recAliases}</span>
            </h2>
            <span className="field-count-badge">{aliases.length}</span>
          </div>
          <div className="aliases-body">
            <div className="aliases-tag-cloud">
              {aliases.map((a, i) => (
                <span className="alias-tag-pill" key={i} dir="auto">
                  {a}
                </span>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Main Group Panels */}
      {activeGroups.map((name) => {
        const entries = groups.get(name) || [];
        return (
          <section className="panel source-section-panel" key={name}>
            <div className="panel-heading">
              <h2>
                <GroupIcon group={name} />
                <span>{groupLabel[name]}</span>
              </h2>
              <span className="field-count-badge">{entries.length}</span>
            </div>
            <div className="source-section-body">
              <dl className="source-field-grid">
                {entries.map(([key, v]) => (
                  <div
                    key={key}
                    className={`source-field-card ${isComplexValue(v) ? 'is-complex-field' : ''}`}
                  >
                    <dt>{detailLabel(key, locale)}</dt>
                    <dd>
                      <Value
                        value={v}
                        valueKey={key}
                        admin={isAdmin}
                        m={m}
                        locale={locale}
                      />
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </section>
        );
      })}

      {!activeGroups.length && !aliases.length && <p className="empty-details-msg">{m.recNoDetails}</p>}

      {/* Provenance Audit Card (Admin Only) */}
      {isAdmin && details._provenance != null && (
        <ProvenanceCard
          provenance={details._provenance as Record<string, unknown>}
          m={m}
          locale={locale}
        />
      )}
    </>
  );
}

