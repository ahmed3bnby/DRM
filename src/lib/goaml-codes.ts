/**
 * UAE FIU goAML — official code tables + XSD validation wiring (SCAFFOLD).
 *
 * The official code tables and the goAML.xsd schema are issued by the UAE Financial
 * Intelligence Unit (FIU) to registered reporting entities. Obtain them like this:
 *   1. Register the entity on goAML via its supervisor
 *      (DNFBPs → Ministry of Economy; financial institutions → Central Bank).
 *   2. From the approved goAML account, download the Schema (goAML.xsd) and the
 *      Reference / Code tables (Report Types, Indicators, Submission codes, …).
 *   3. Fill the maps below from those tables and set GOAML_SCHEMA_VERSION.
 *
 * UNTIL these are filled, generateGoAmlXml() falls back to the app's INTERNAL codes,
 * which are structurally valid XML but are NOT accepted for real FIU submission.
 * `isGoAmlMappingComplete()` tells the UI/export whether a filing is submission-ready.
 */

// e.g. '4.9' — read from the downloaded goAML.xsd. Empty = mapping not configured yet.
export const GOAML_SCHEMA_VERSION = '';

// App report type (SAR | STR | REAR | FARI | DPMSR | HRC | AIF) → official goAML report_code.
// Fill from the FIU "Report Types" reference table.
export const REPORT_CODE_MAP: Record<string, string> = {
  // SAR: '',
  // STR: '',
  // REAR: '',
  // FARI: '',
  // DPMSR: '',
};

// App reason_category → official goAML <indicator> code. Fill from the FIU "Indicators" table.
export const INDICATOR_CODE_MAP: Record<string, string> = {
  // money_laundering: '',
  // terrorism_financing: '',
  // ...
};

/** Map an app report type to its official goAML report_code. `official:false` = unmapped (fallback). */
export function toGoAmlReportCode(appReportType: string): { code: string; official: boolean } {
  const m = REPORT_CODE_MAP[appReportType];
  return m ? { code: m, official: true } : { code: appReportType, official: false };
}

/** Map an app reason_category to its official goAML indicator code. */
export function toGoAmlIndicator(appReason: string): { code: string; official: boolean } {
  const m = INDICATOR_CODE_MAP[appReason];
  return m ? { code: m, official: true } : { code: appReason, official: false };
}

/** True only when the official codes + schema version are configured (filing is submission-ready). */
export function isGoAmlMappingComplete(): boolean {
  return (
    GOAML_SCHEMA_VERSION.trim() !== '' &&
    Object.keys(REPORT_CODE_MAP).length > 0 &&
    Object.keys(INDICATOR_CODE_MAP).length > 0
  );
}

/**
 * XSD validation wiring (enable once goAML.xsd is available):
 *   1. Place the schema at db/goaml/goAML.xsd (download from the goAML account).
 *   2. Add a validator dependency (e.g. `libxmljs2`) and implement:
 *
 *      import { readFileSync } from 'node:fs';
 *      import { parseXml } from 'libxmljs2';
 *      export function validateGoAmlXml(xml: string): { valid: boolean; errors: string[] } {
 *        const xsd = parseXml(readFileSync('db/goaml/goAML.xsd', 'utf8'));
 *        const doc = parseXml(xml);
 *        const valid = doc.validate(xsd);
 *        return { valid, errors: (doc.validationErrors || []).map(String) };
 *      }
 *
 *   3. Call it in the sar-export route before returning the XML, and block/flag
 *      submission when invalid.
 */
export const GOAML_XSD_PATH = 'db/goaml/goAML.xsd'; // place the official schema here
