export interface OrganizationBranding {
  companyName?: string;
  logoUrl?: string;
  licenseNumber?: string;
  regulatorName?: string;
  contactEmail?: string;
  contactPhone?: string;
  customHeaderNote?: string;
  customFooterNote?: string;
  primaryColor?: string;
  enabled?: boolean;
}

export const DEFAULT_BRANDING: OrganizationBranding = {
  companyName: '',
  logoUrl: '',
  licenseNumber: '',
  regulatorName: 'UAE Ministry of Economy / Central Bank',
  contactEmail: '',
  contactPhone: '',
  customHeaderNote: '',
  customFooterNote: 'وثيقة امتثال وتدقيق رسمية معتمدة وفق متطلبات وحدة المعلومات المالية ومصرف الإمارات المركزي.',
  primaryColor: '#0f172a',
  enabled: true,
};
