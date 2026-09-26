'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { PanelRightClose, PanelRightOpen } from 'lucide-react';

const storageKey = 'sidebar';

export default function SidebarShell({ children, closeLabel, openLabel }: { children: ReactNode; closeLabel: string; openLabel: string }) {
  const [collapsed, setCollapsed] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => { setCollapsed(localStorage.getItem(storageKey) === 'closed'); setReady(true); }, []);
  useEffect(() => { if (ready) localStorage.setItem(storageKey, collapsed ? 'closed' : 'open'); }, [collapsed, ready]);
  return <aside className={`sidebar${collapsed ? ' is-collapsed' : ''}`}>
    <button type="button" className="sidebar-toggle" aria-expanded={!collapsed} aria-label={collapsed ? openLabel : closeLabel} title={collapsed ? openLabel : closeLabel} onClick={() => setCollapsed(value => !value)}>
      {collapsed ? <PanelRightOpen size={18}/> : <PanelRightClose size={18}/>}
    </button>
    {children}
  </aside>;
}
