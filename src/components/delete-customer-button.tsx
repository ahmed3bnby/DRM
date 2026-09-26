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
    >
      <input type="hidden" name="customerId" value={customerId} />
      <button
        type="submit"
        className="button danger sm delete-customer-btn"
        title={isArabic ? 'حذف هذا العميل نهائياً' : 'Delete this customer permanently'}
      >
        <Trash2 size={15} />
        <span>{isArabic ? 'حذف العميل' : 'Delete Customer'}</span>
      </button>
    </form>
  );
}
