'use client';

import { useState, useEffect, ReactNode } from 'react';
import { FileText, ShieldAlert, Activity, Clock3, AlertTriangle } from 'lucide-react';
import { useLocale } from './locale-context';

export type ProfileTabItem = {
  id: string;
  label: string;
  iconName?: 'summary' | 'matches' | 'risk' | 'activity';
  badge?: number | string;
  badgeType?: 'neutral' | 'amber' | 'blue' | 'danger';
  content: ReactNode;
};

type ProfileTabsViewProps = {
  tabs: ProfileTabItem[];
  defaultTab?: string;
};

export default function ProfileTabsView({ tabs, defaultTab = 'summary' }: ProfileTabsViewProps) {
  const { locale } = useLocale();
  const [activeTab, setActiveTab] = useState<string>(defaultTab);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  useEffect(() => {
    // Check initial hash after hydration completes
    const initialHash = window.location.hash.replace('#', '');
    if (initialHash && tabs.some(t => t.id === initialHash)) {
      setActiveTab(initialHash);
    }

    const handleHash = () => {
      const hash = window.location.hash.replace('#', '');
      if (tabs.some(t => t.id === hash)) {
        setActiveTab(hash);
      }
    };
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, [tabs]);

  const selectTab = (id: string) => {
    setActiveTab(id);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.hash = id;
      window.history.replaceState(null, '', url.toString());
    }
  };

  const getIcon = (type?: string) => {
    switch (type) {
      case 'summary':
        return <FileText size={17} />;
      case 'matches':
        return <ShieldAlert size={17} />;
      case 'risk':
        return <Activity size={17} />;
      case 'activity':
        return <Clock3 size={17} />;
      default:
        return null;
    }
  };

  return (
    <div className="profile-tabs-container">
      <div className="profile-tab-bar" role="tablist" aria-label="Profile navigation">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`tab-btn-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`tab-panel-${tab.id}`}
              className={`profile-tab-button ${isActive ? 'active' : ''}`}
              onClick={() => selectTab(tab.id)}
              type="button"
            >
              {tab.iconName && <span className="tab-icon">{getIcon(tab.iconName)}</span>}
              <span className="tab-label">{tab.label}</span>
              {tab.badge !== undefined && tab.badge !== 0 && (
                <span className={`tab-badge ${tab.badgeType || 'neutral'}`}>
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="profile-tab-panels">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id;
          return (
            <div
              key={tab.id}
              role="tabpanel"
              id={`tab-panel-${tab.id}`}
              aria-labelledby={`tab-btn-${tab.id}`}
              className={`profile-tab-panel ${isActive ? 'active' : 'hidden'}`}
              tabIndex={0}
            >
              {tab.content}
            </div>
          );
        })}
      </div>
    </div>
  );
}
