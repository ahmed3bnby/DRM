import { NextResponse } from 'next/server';
import JSZip from 'jszip';
import * as XLSX from 'xlsx';
import { requireActor } from '@/lib/auth';
import { withTenant } from '@/lib/db';
import { getLastScreening } from '@/lib/screening';
import { getMatchDecisions } from '@/lib/decisions';
import { listSarReportsForCustomer, generateGoAmlXml } from '@/lib/goaml';
import { computeRiskRating } from '@/lib/risk-rating';
import type { Customer } from '@/lib/customers';

export const dynamic = 'force-dynamic';

function cleanFilename(str: string): string {
  return str.replace(/[^a-zA-Z0-9_\u0600-\u06FF-]/g, '_').slice(0, 50);
}

function generateHtmlReport(
  customer: Customer,
  lastScreening: any,
  decisions: Record<string, any>,
  orgName: string,
  officerName: string
): string {
  const isCompany = customer.entity_type === 'company';
  const matches = lastScreening?.top_matches || [];

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>تقرير فحص امتثال - ${customer.reference} - ${customer.name}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 30px; line-height: 1.5; }
    .doc { max-width: 800px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 8px; border: 1px solid #e2e8f0; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
    .header { border-bottom: 2px solid #0f172a; padding-bottom: 20px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start; }
    .brand { font-size: 11px; font-weight: 700; color: #166534; background: #f0fdf4; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 6px; }
    h1 { font-size: 22px; margin: 0 0 4px; color: #0f172a; }
    .meta-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; background: #f8fafc; padding: 16px; border-radius: 6px; margin-bottom: 24px; font-size: 13px; }
    .meta-item span { color: #64748b; font-size: 11px; display: block; }
    .meta-item strong { color: #0f172a; font-size: 14px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
    th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: right; }
    th { background: #f1f5f9; font-weight: 600; }
    .badge { padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; display: inline-block; }
    .badge-high { background: #fee2e2; color: #991b1b; }
    .badge-medium { background: #fef3c7; color: #92400e; }
    .badge-low { background: #dcfce7; color: #166534; }
    .footer { margin-top: 30px; border-top: 1px solid #e2e8f0; padding-top: 16px; font-size: 11px; color: #94a3b8; display: flex; justify-content: space-between; }
    @media print { body { background: #fff; padding: 0; } .doc { border: none; box-shadow: none; padding: 0; } }
  </style>
</head>
<body>
  <div class="doc">
    <div class="header">
      <div>
        <span class="brand">DRM COMPLIANCE · STATUTORY AUDIT RECORD</span>
        <h1>تقرير فحص الامتثال ومكافحة غسل الأموال</h1>
        <p style="margin: 0; font-size: 12px; color: #64748b;">سجل فحص وتدقيق رسمي معتمد للمطابقة مع القوائم المحلية والدولية</p>
      </div>
      <div style="text-align: left;">
        <span style="font-size: 11px; color: #64748b; display: block;">المرجع الرقابي</span>
        <strong style="font-family: monospace; font-size: 15px;">${customer.reference}</strong>
      </div>
    </div>

    <div class="meta-grid">
      <div class="meta-item">
        <span>اسم العميل / المنشأة</span>
        <strong>${customer.name}</strong>
      </div>
      <div class="meta-item">
        <span>نوع الكيان</span>
        <strong>${isCompany ? 'شركة / منشأة اعتبارية' : 'شخص طبيعي (فرد)'}</strong>
      </div>
      <div class="meta-item">
        <span>الدولة / المقر</span>
        <strong>${customer.country || 'غير محدد'}</strong>
      </div>
      <div class="meta-item">
        <span>رقم الهوية / السجل التجاري</span>
        <strong style="font-family: monospace;">${customer.identifier || '—'}</strong>
      </div>
      <div class="meta-item">
        <span>حالة الفحص الأمني</span>
        <strong>${customer.screening_status}</strong>
      </div>
      <div class="meta-item">
        <span>المراقبة المستمرة 24/7</span>
        <strong>${customer.monitoring_enabled ? 'مفعّلة (نشطة)' : 'غير مفعّلة'}</strong>
      </div>
    </div>

    <h2 style="font-size: 14px; margin-bottom: 8px;">نتائج المطابقة وفحص القوائم (${matches.length})</h2>
    ${
      matches.length === 0
        ? '<p style="font-size: 13px; color: #166534; background: #f0fdf4; padding: 12px; border-radius: 6px;">لم يتم رصد أي مؤشرات اشتباه أو مطابقات في القوائم الرسمية المفحوصة (No Match).</p>'
        : `<table>
            <thead>
              <tr>
                <th>الاسم المتطابق</th>
                <th>الفئة</th>
                <th>مصدر القائمة</th>
                <th>نسبة التطابق</th>
                <th>قرار المحلل</th>
                <th>ملاحظات القرار</th>
              </tr>
            </thead>
            <tbody>
              ${matches
                .map((m: any) => {
                  const d = decisions[m.recordId];
                  return `<tr>
                    <td><strong>${m.name}</strong></td>
                    <td>${m.category || 'sanctions'}</td>
                    <td>${m.source}</td>
                    <td dir="ltr">${m.percent}%</td>
                    <td>${d ? d.decision : 'لم يُراجع'}</td>
                    <td>${d?.reason || '—'}</td>
                  </tr>`;
                })
                .join('')}
            </tbody>
          </table>`
    }

    <div class="footer">
      <span>المنشأة: ${orgName} · المحلل: ${officerName}</span>
      <span>تاريخ إصدار التقرير: ${new Date().toLocaleDateString('ar-AE')}</span>
    </div>
  </div>
</body>
</html>`;
}

function generateHtmlCertificate(
  customer: Customer,
  orgName: string,
  officerName: string
): string {
  const lastScan = customer.last_monitored_at || customer.created_at;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <title>شهادة المراقبة المستمرة - ${customer.reference}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f8fafc; color: #0f172a; margin: 0; padding: 30px; }
    .doc { max-width: 800px; margin: 0 auto; background: #fff; padding: 40px; border-radius: 10px; border: 2px solid #166534; box-shadow: 0 4px 14px rgba(0,0,0,0.05); }
    .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 20px; margin-bottom: 24px; }
    .badge { background: #f0fdf4; color: #166534; padding: 6px 14px; border-radius: 20px; font-size: 12px; font-weight: 700; display: inline-block; margin-bottom: 10px; }
    h1 { font-size: 24px; margin: 0 0 6px; color: #0f172a; }
    .sub { font-size: 13px; color: #64748b; margin: 0; }
    .cert-body { background: #f8fafc; padding: 20px; border-radius: 8px; margin-bottom: 24px; font-size: 14px; line-height: 1.8; }
    .footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; padding-top: 20px; font-size: 12px; }
    .stamp { border: 2px dashed #166534; border-radius: 8px; padding: 8px 16px; text-align: center; color: #166534; font-weight: 700; font-size: 11px; }
    @media print { body { background: #fff; padding: 0; } .doc { border: 1px solid #000; box-shadow: none; } }
  </style>
</head>
<body>
  <div class="doc">
    <div class="header">
      <div class="badge">AML / CFT STATUTORY SURVEILLANCE CERTIFICATE</div>
      <h1>شهادة خضوع للمراقبة المستمرة والفحص الآلي الدوري</h1>
      <p class="sub">إفادة رقابية صادرة وفقاً لقرار مجلس الوزراء الإماراتي رقم (74) لسنة 2020 بشأن تدابير مكافحة غسل الأموال</p>
    </div>

    <div class="cert-body">
      تشهد <strong>${orgName}</strong> بأن العميل الموضحة بياناته أدناه خاضع رسمياً لمنظومة الفحص الأمني والمراقبة المستمرة على مدار الساعة (24/7 Ongoing AML Surveillance):
      <br/><br/>
      • <strong>اسم العميل:</strong> ${customer.name}<br/>
      • <strong>المرجع بالنظام:</strong> <span style="font-family: monospace;">${customer.reference}</span><br/>
      • <strong>الدولة / المقر:</strong> ${customer.country || 'N/A'}<br/>
      • <strong>رقم الهوية / السجل:</strong> <span style="font-family: monospace;">${customer.identifier || '—'}</span><br/>
      • <strong>تاريخ آخر فحص تحققي:</strong> ${new Date(lastScan).toLocaleDateString('ar-AE')}<br/>
      • <strong>حالة المراقبة:</strong> ${customer.monitoring_status === 'flagged' ? 'تم رصد مستجدات للمراجعة' : 'سليم ومحمي (Active & Clear)'}
    </div>

    <div class="footer">
      <div>
        <span>مسؤول الامتثال: <strong>${officerName}</strong></span><br/>
        <span style="color: #64748b; font-size: 11px;">تاريخ التوثيق: ${new Date().toLocaleDateString('ar-AE')}</span>
      </div>
      <div class="stamp">
        DRM COMPLIANCE<br/>OFFICIALLY VERIFIED
      </div>
    </div>
  </div>
</body>
</html>`;
}

export async function POST(req: Request) {
  try {
    const actor = await requireActor();
    const body = await req.json();
    const customerIds: string[] = body.customerIds || [];

    if (!Array.isArray(customerIds) || customerIds.length === 0) {
      return NextResponse.json({ error: 'يرجى تحديد عميل واحد على الأقل للتصدير' }, { status: 400 });
    }

    // Limit batch size to 100 for performance
    const targetIds = customerIds.slice(0, 100);

    const customers: Customer[] = await withTenant(actor.organizationId, async db => {
      const res = await db.query(
        `SELECT * FROM customers WHERE organization_id = $1 AND (id = ANY($2::uuid[]) OR reference = ANY($2::text[]))`,
        [actor.organizationId, targetIds]
      );
      return res.rows;
    });

    if (customers.length === 0) {
      return NextResponse.json({ error: 'لم يتم العثور على عملاء مطابقين للاختيار' }, { status: 404 });
    }

    const zip = new JSZip();
    const manifestRows: (string | number)[][] = [
      [
        'المرجع الرقابي (Ref)',
        'اسم العميل (Name)',
        'نوع الكيان (Type)',
        'الدولة (Country)',
        'المعرف / السجل (ID/CR)',
        'حالة الملف (Status)',
        'حالة الفحص (Screening)',
        'المراقبة المستمرة 24/7 (Surveillance)',
        'تاريخ الإنشاء (Created At)',
        'تاريخ آخر فحص (Last Screened)',
        'عدد المطابقات (Matches)',
        'بلاغات goAML (SAR Filed)',
        'مسؤول الإدخال (Creator)',
      ],
    ];

    const reportsFolder = zip.folder('reports');
    const certsFolder = zip.folder('certificates');
    const sarFolder = zip.folder('goaml_sar');

    const orgName = actor.organizationName || 'Financial Institution';

    for (const customer of customers) {
      const safeName = cleanFilename(customer.name);
      const [lastScreening, decisions, sarReports] = await Promise.all([
        getLastScreening(actor.organizationId, customer.id),
        getMatchDecisions(actor.organizationId, customer.id),
        listSarReportsForCustomer(actor.organizationId, customer.id),
      ]);

      const matchCount = lastScreening?.top_matches?.length || 0;
      const lastScreenDate = lastScreening?.created_at
        ? new Date(lastScreening.created_at).toLocaleDateString('ar-AE')
        : 'لم يُفحص';

      // 1. Add to Manifest
      manifestRows.push([
        customer.reference,
        customer.name,
        customer.entity_type === 'company' ? 'شركة' : 'فرد',
        customer.country,
        customer.identifier || '—',
        customer.status,
        customer.screening_status,
        customer.monitoring_enabled ? 'مفعّلة 24/7' : 'غير مفعّلة',
        new Date(customer.created_at).toLocaleDateString('ar-AE'),
        lastScreenDate,
        matchCount,
        sarReports.length,
        customer.creator_name || actor.displayName,
      ]);

      // 2. Generate and Add Screening HTML Report
      const htmlReport = generateHtmlReport(
        customer,
        lastScreening,
        decisions,
        orgName,
        actor.displayName
      );
      reportsFolder?.file(`KYC_Report_${customer.reference}_${safeName}.html`, htmlReport);

      // 3. Generate and Add Surveillance Certificate (if monitored)
      if (customer.monitoring_enabled !== false) {
        const certHtml = generateHtmlCertificate(customer, orgName, actor.displayName);
        certsFolder?.file(
          `Surveillance_Certificate_${customer.reference}_${safeName}.html`,
          certHtml
        );
      }

      // 4. Add SAR XML exports (if any)
      for (const sar of sarReports) {
        const xml = generateGoAmlXml(sar, {
          name: orgName,
          orgId: actor.organizationId,
        });
        sarFolder?.file(`goAML_${sar.reference_number}_${customer.reference}.xml`, xml);
      }
    }

    // 5. Generate Excel Manifest
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(manifestRows);
    XLSX.utils.book_append_sheet(wb, ws, 'Audit_Manifest');
    const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    zip.file('Audit_Manifest.xlsx', excelBuffer);

    // 6. Generate README Inspector File
    const readmeContent = `======================================================================
DRM COMPLIANCE SYSTEM — STATUTORY AUDIT & INSPECTION DOSSIER
======================================================================
Generated On: ${new Date().toISOString()}
Reporting Entity: ${orgName}
Exported By: ${actor.displayName} (${actor.role})
Total Customer Records Audited: ${customers.length}

PACKAGE CONTENTS:
-----------------
1. Audit_Manifest.xlsx:
   Master index spreadsheet containing all customer references, KYC statuses,
   risk classifications, and screening outcomes.

2. /reports:
   Official standalone KYC & Watchlist screening reports for each subject.
   These files can be opened in any browser or printed directly to PDF for filing.

3. /certificates:
   Statutory 24/7 Ongoing Surveillance Certificates for monitored customers in
   accordance with UAE Cabinet Resolution No. 74 of 2020.

4. /goaml_sar:
   Official UNODC goAML-compliant XML dossiers for any suspicious activity or
   transaction reports recorded for these subjects.

CONFIDENTIALITY NOTICE:
-----------------------
This package contains strictly confidential regulatory compliance records.
Unauthorized distribution or disclosure is strictly prohibited under UAE AML laws.
======================================================================`;
    zip.file('README_AUDIT_INSPECTION.txt', readmeContent);

    // 7. Generate ZIP Buffer
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const filename = `DRM_Audit_Dossier_${timestamp}.zip`;

    return new NextResponse(zipBuffer as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });
  } catch (err: any) {
    console.error('Audit export error:', err);
    return NextResponse.json({ error: err.message || 'Export error' }, { status: 500 });
  }
}
