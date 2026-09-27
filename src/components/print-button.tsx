'use client';

import { Printer } from 'lucide-react';

export default function PrintButton({
  label = 'طباعة / حفظ PDF',
  filename,
}: {
  label?: string;
  filename?: string;
}) {
  const handlePrint = () => {
    const originalTitle = document.title;
    if (filename) {
      // Remove any illegal filename characters across operating systems: / \ : * ? " < > |
      const safeFilename = filename.replace(/[\\/:*?"<>|]/g, '-').trim();
      if (safeFilename) {
        document.title = safeFilename;
      }
    }

    window.print();

    const restoreTitle = () => {
      if (filename) {
        document.title = originalTitle;
      }
      window.removeEventListener('afterprint', restoreTitle);
    };
    window.addEventListener('afterprint', restoreTitle);
  };

  return (
    <button
      type="button"
      className="button primary no-print"
      onClick={handlePrint}
      title={filename ? `حفظ التقرير كـ PDF باسم: ${filename}` : label}
    >
      <Printer size={17} />
      <span>{label}</span>
    </button>
  );
}
