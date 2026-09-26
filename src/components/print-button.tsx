'use client';
import { Printer } from 'lucide-react';
export default function PrintButton({ label = 'طباعة / حفظ PDF' }: { label?: string }) {
  return <button type="button" className="button primary no-print" onClick={() => window.print()}><Printer size={17}/>{label}</button>;
}
