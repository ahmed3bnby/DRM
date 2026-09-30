'use client';
import { Trash2 } from 'lucide-react';
import { deleteCustomerAction } from '@/app/actions';

export default function DeleteCustomerButton({
  customerId,
  customerName,
  isArabic
}: {
  customerId: string;
  customerName: string;
  isArabic: boolean;
}) {
  return (
    <form
      action={deleteCustomerAction}
      onSubmit={(e) => {
        const msg = isArabic
          ? `هل أنت متأكد من حذف ملف العميل «${customerName}» نهائياً؟\nسيتم حذف كافة الفحوصات وسجلات المراجعة وقرارات المطابقة التابعة له ولا يمكن التراجع عن هذه الخطوة.`
          : `Are you sure you want to permanently delete customer "${customerName}"?\nAll associated screenings, reviews, and decisions will be deleted. This action cannot be undone.`;
        if (!window.confirm(msg)) {
          e.preventDefault();
        }
      }}
      style={{ display: 'inline-flex', margin: 0 }}
    >
      <input type="hidden" name="customerId" value={customerId} />
      <button
        type="submit"
        className="button danger sm delete-customer-btn"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '6px',
          minHeight: '38px',
          height: '38px',
          padding: '0 12px',
          fontSize: '12px',
          fontWeight: 500,
          borderRadius: '7px',
          transition: 'all 0.15s ease',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          lineHeight: 1,
          border: '1px solid #fca5a5',
          background: '#ffffff',
          color: '#b91c1c'
        }}
        title={isArabic ? 'حذف هذا العميل نهائياً' : 'Delete this customer permanently'}
      >
        <Trash2 size={15} style={{ flexShrink: 0 }} />
        <span>{isArabic ? 'حذف العميل' : 'Delete Customer'}</span>
      </button>
    </form>
  );
}
