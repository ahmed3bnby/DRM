/**
 * OpenSanctions API Integration
 * Provides international coverage across:
 * - Politically Exposed Persons (PEPs)
 * - Interpol Red Notices & Wanted Lists
 * - World Bank & MDB Debarment lists
 * - Consolidated Global Sanctions (OFAC, EU, UN, UK OFSI, etc.)
 */

export interface OpenSanctionsResult {
  id: string;
  caption: string;
  schema: string;
  score: number;
  topics: string[];
  datasets: string[];
  countries: string[];
  birthDates: string[];
  summary?: string;
  referenceUrl?: string;
}

export async function matchOpenSanctions(params: {
  name: string;
  entityType?: 'individual' | 'company';
  country?: string;
  dateOfBirth?: string;
  threshold?: number;
}): Promise<OpenSanctionsResult[]> {
  const { name, entityType = 'individual', country, dateOfBirth, threshold = 0.70 } = params;

  if (!name || name.trim().length < 2) {
    return [];
  }

  const schema = entityType === 'company' ? 'Company' : 'Person';
  const properties: Record<string, string[]> = {
    name: [name.trim()]
  };

  if (country) {
    properties.country = [country.toLowerCase()];
  }

  if (dateOfBirth) {
    properties.birthDate = [dateOfBirth];
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 4500);

  try {
    const apiKey = process.env.OPENSANCTIONS_API_KEY;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (apiKey) {
      headers['Authorization'] = `Bearer ${apiKey}`;
    }

    const res = await fetch('https://api.opensanctions.org/match/default?algorithm=best', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        queries: {
          q1: {
            schema,
            properties
          }
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!res.ok) {
      console.warn(`OpenSanctions API responded with status ${res.status}`);
      return [];
    }

    const data = await res.json();
    const queryResults = data?.responses?.q1?.results || [];

    return queryResults
      .filter((r: any) => typeof r.score === 'number' && r.score >= threshold)
      .map((r: any) => {
        const props = r.properties || {};
        return {
          id: r.id,
          caption: r.caption || props.name?.[0] || 'Unknown Entity',
          schema: r.schema,
          score: Math.round(r.score * 100),
          topics: props.topics || [],
          datasets: r.datasets || [],
          countries: props.country || props.nationality || [],
          birthDates: props.birthDate || [],
          summary: props.notes?.[0] || props.description?.[0] || undefined,
          referenceUrl: `https://www.opensanctions.org/entities/${encodeURIComponent(r.id)}/`
        };
      });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name !== 'AbortError') {
      console.warn('OpenSanctions API request failed:', err?.message || err);
    }
    return [];
  }
}
