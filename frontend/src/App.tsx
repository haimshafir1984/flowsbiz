import { useState, useEffect } from 'react';

// Interfaces mapping Domain definitions
interface Client {
  id: string;
  name: string;
  company_registration_number: string;
  website: string;
  meta_waba_id: string;
  meta_phone_number_id: string;
  meta_permanent_access_token: string;
  status: string;
  created_at: string;
}

interface Contact {
  id: string;
  client_id: string;
  phone_number: string;
  first_name: string;
  last_name: string;
  custom_attributes: Record<string, any>;
  opt_in_status: 'granted' | 'revoked';
  opt_in_date: string;
}

interface Campaign {
  id: string;
  client_id: string;
  name: string;
  template_name: string;
  template_language: string;
  status: 'draft' | 'scheduled' | 'processing' | 'completed' | 'failed';
  total_contacts_count: number;
  sent_count: number;
  delivered_count: number;
  read_count: number;
  failed_count: number;
}

interface MessageLog {
  id: string;
  client_id: string;
  campaign_id: string | null;
  contact_id: string;
  phone_number: string;
  meta_message_id: string | null;
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed' | 'skipped_opt_out';
  error_code: string | null;
  error_message: string | null;
  sent_at: string | null;
}

interface AuditLog {
  id: string;
  client_id: string;
  action: string;
  actor: string;
  payload: Record<string, any>;
  timestamp: string;
}

function App() {
  // SaaS Auth Role Selection ('ADMIN' or 'CLIENT')
  const [role, setRole] = useState<'ADMIN' | 'CLIENT'>('ADMIN');
  
  // Navigation Menu (changes based on active role)
  const [activeMenu, setActiveMenu] = useState<'tenants' | 'contacts' | 'campaigns' | 'simulator' | 'userView' | 'globalAudits'>('campaigns');

  // Multi-Tenant context selection
  const [clients, setClients] = useState<Client[]>([]);
  const [activeClient, setActiveClient] = useState<Client | null>(null);

  // Lists state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaignMessages, setSelectedCampaignMessages] = useState<MessageLog[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [audits, setAudits] = useState<AuditLog[]>([]);
  const [globalAudits, setGlobalAudits] = useState<AuditLog[]>([]);

  // Connectivity indicators
  const [backendStatus, setBackendStatus] = useState<'live' | 'checking' | 'offline'>('checking');

  // Chat simulator states
  const [simulatedContact, setSimulatedContact] = useState<Contact | null>(null);
  const [simulatedChatMessages, setSimulatedChatMessages] = useState<{ sender: 'user' | 'business', text: string, time: string }[]>([]);
  const [chatInputText, setChatInputText] = useState('');

  // Form input states
  // 1. Client form
  const [clientName, setClientName] = useState('');
  const [clientRegNum, setClientRegNum] = useState('');
  const [clientWeb, setClientWeb] = useState('');
  const [wabaId, setWabaId] = useState('');
  const [phoneId, setPhoneId] = useState('');
  const [accessToken, setAccessToken] = useState('');

  // 2. Contact form
  const [contactPhone, setContactPhone] = useState('');
  const [contactFirst, setContactFirst] = useState('');
  const [contactLast, setContactLast] = useState('');
  const [contactAttr, setContactAttr] = useState('{"1": "שם פרטי", "2": "מבצע קיץ"}');

  // 3. Campaign form
  const [campName, setCampName] = useState('');
  const [campTemplate, setCampTemplate] = useState('hello_world');
  const [campLang, setCampLang] = useState('he');

  // Loading & logs
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  // CSV Drag and Drop states
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedCsvFile, setSelectedCsvFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  // Helper to build headers with active SaaS Role context
  const getAuthHeaders = (extraHeaders: Record<string, string> = {}) => {
    return {
      'X-User-Role': role,
      'X-Client-Id': activeClient?.id || '',
      ...extraHeaders
    };
  };

  // Auto-select first contact for simulation context
  useEffect(() => {
    if (contacts.length > 0 && !simulatedContact) {
      setSimulatedContact(contacts[0]);
    }
  }, [contacts]);

  // Load chat messages when simulated contact changes
  useEffect(() => {
    if (simulatedContact && activeClient) {
      const bizName = activeClient.name;
      const userName = simulatedContact.first_name;
      const attrParam = simulatedContact.custom_attributes["2"] || "מבצע מיוחד";
      const templateMsg = `היי *${userName}*, יש לנו הצעה חופפת מיוחדת עבורך ב*${bizName}* למועד ה*${attrParam}*! לקבלת ההטבה לחץ על הקישור הבא או השב 'הסר' להסרה.`;
      setSimulatedChatMessages([
        { sender: 'business', text: templateMsg, time: '11:34' }
      ]);
    }
  }, [simulatedContact, activeClient]);

  // Reset menu mapping when switching role to prevent viewing forbidden tabs
  useEffect(() => {
    if (role === 'CLIENT') {
      if (activeMenu === 'tenants' || activeMenu === 'globalAudits' || activeMenu === 'simulator') {
        setActiveMenu('campaigns');
      }
    }
  }, [role, activeMenu]);

  const handleSendSimulatedChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInputText.trim() || !simulatedContact || !activeClient) return;

    const userText = chatInputText.trim();
    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    // Add user message to simulated thread
    setSimulatedChatMessages(prev => [...prev, { sender: 'user', text: userText, time: nowTime }]);
    setChatInputText('');

    if (userText === 'הסר' || userText === 'להסיר' || userText.toLowerCase() === 'unsubscribe') {
      setIsLoading(true);
      try {
        // Trigger simulation endpoint on the backend (Webhooks don't need auth headers - mimics Facebook API call)
        const res = await fetch(`/api/v1/webhooks/simulate-webhook?event_type=user_unsubscribe&phone_number=${encodeURIComponent(simulatedContact.phone_number)}`, {
          method: 'POST'
        });
        if (res.ok) {
          showStatus('success', 'סימולציית הסרה בוצעה דרך הצ\'אט!');
          fetchTenantData();
          
          // Append business automatic reply inside chat thread
          setTimeout(() => {
            setSimulatedChatMessages(prev => [...prev, {
              sender: 'business',
              text: `הסרת הדיוור בוצעה בהצלחה. לא יישלחו אליך הודעות נוספות מ-${activeClient.name}. לשירותך תמיד!`,
              time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            }]);
          }, 1000);
        }
      } catch {
        showStatus('error', 'תקשורת נכשלה בעת סימולציית ההסרה');
      } finally {
        setIsLoading(false);
      }
    } else {
      // General automatic mock reply for testing
      setTimeout(() => {
        setSimulatedChatMessages(prev => [...prev, {
          sender: 'business',
          text: `תודה על פנייתך ל-${activeClient.name}! נציג מטעמנו יחזור אליך בהקדם לשירותך. לביטול הרשמה השב 'הסר'.`,
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }]);
      }, 1000);
    }
  };

  const checkHealth = async () => {
    setBackendStatus('checking');
    try {
      const res = await fetch('/api/v1/health');
      if (res.ok) {
        setBackendStatus('live');
        fetchClients();
      } else {
        throw new Error();
      }
    } catch {
      setBackendStatus('offline');
    }
  };

  const fetchClients = async () => {
    try {
      const res = await fetch('/api/v1/campaigns/clients', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setClients(data);
        if (data.length > 0 && !activeClient) {
          setActiveClient(data[0]);
        }
      }
    } catch (err) {
      console.error('Failed to load tenants:', err);
    }
  };

  const fetchGlobalAudits = async () => {
    if (role !== 'ADMIN') return;
    try {
      const res = await fetch('/api/v1/campaigns/global/audits', {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setGlobalAudits(data);
      }
    } catch (err) {
      console.error('Failed to fetch global audits:', err);
    }
  };

  const fetchTenantData = async () => {
    if (!activeClient) return;
    try {
      // Fetch Campaigns
      const campRes = await fetch(`/api/v1/campaigns/${activeClient.id}`, {
        headers: getAuthHeaders()
      });
      if (campRes.ok) {
        const campData = await campRes.json();
        setCampaigns(campData);
      }

      // Fetch Contacts
      const contRes = await fetch(`/api/v1/contacts/${activeClient.id}`, {
        headers: getAuthHeaders()
      });
      if (contRes.ok) {
        const contData = await contRes.json();
        setContacts(contData);
      }

      // Fetch Audit logs
      const auditRes = await fetch(`/api/v1/campaigns/${activeClient.id}/audits`, {
        headers: getAuthHeaders()
      });
      if (auditRes.ok) {
        const auditData = await auditRes.json();
        setAudits(auditData);
      }

      // Fetch global logs if in admin role context
      if (role === 'ADMIN') {
        fetchGlobalAudits();
      }
    } catch (err) {
      console.error('Failed to fetch tenant data:', err);
    }
  };

  useEffect(() => {
    checkHealth();
  }, []);

  // Re-fetch data whenever the active client context OR user role switches
  useEffect(() => {
    if (activeClient) {
      fetchTenantData();
      setSelectedCampaign(null);
      setSelectedCampaignMessages([]);
    }
  }, [activeClient, role]);

  // Load clients lists for Admin whenever role switches back to Admin
  useEffect(() => {
    if (role === 'ADMIN') {
      fetchClients();
      fetchGlobalAudits();
    }
  }, [role]);

  const handleCreateClient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientName || !wabaId || !phoneId || !accessToken) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/v1/campaigns/clients', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          name: clientName,
          company_registration_number: clientRegNum || 'N/A',
          website: clientWeb || 'N/A',
          meta_waba_id: wabaId,
          meta_phone_number_id: phoneId,
          meta_permanent_access_token: accessToken
        })
      });
      if (res.ok) {
        const newClient = await res.json();
        setClients(prev => [newClient, ...prev]);
        setActiveClient(newClient);
        setClientName('');
        setClientRegNum('');
        setClientWeb('');
        setWabaId('');
        setPhoneId('');
        setAccessToken('');
        showStatus('success', 'לקוח חדש נוצר והוגדר בהצלחה!');
      } else {
        const err = await res.json();
        showStatus('error', err.detail || 'שגיאה ביצירת הלקוח. בדוק קלט ונסה שוב.');
      }
    } catch {
      showStatus('error', 'שגיאה ביצירת הלקוח. בדוק קלט ונסה שוב.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient || !contactPhone || !contactFirst) return;
    setIsLoading(true);
    let parsedAttr = {};
    try {
      parsedAttr = JSON.parse(contactAttr);
    } catch {
      showStatus('error', 'שגיאה במבנה ה-JSON של המאפיינים האישיים');
      setIsLoading(false);
      return;
    }

    try {
      const res = await fetch(`/api/v1/contacts/${activeClient.id}`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          phone_number: contactPhone,
          first_name: contactFirst,
          last_name: contactLast || '',
          custom_attributes: parsedAttr
        })
      });
      if (res.ok) {
        const newContact = await res.json();
        // Update contact list or replace existing
        setContacts(prev => {
          const index = prev.findIndex(c => c.phone_number === newContact.phone_number);
          if (index !== -1) {
            const updated = [...prev];
            updated[index] = newContact;
            return updated;
          }
          return [newContact, ...prev];
        });
        setContactPhone('');
        setContactFirst('');
        setContactLast('');
        showStatus('success', 'איש קשר נוסף ונקלט בהצלחה!');
      } else {
        const err = await res.json();
        showStatus('error', err.detail || 'שגיאה בקליטת איש הקשר');
      }
    } catch {
      showStatus('error', 'שגיאה בקליטת איש הקשר');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCsvUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient || !selectedCsvFile) return;

    setIsLoading(true);
    const formData = new FormData();
    formData.append('file', selectedCsvFile);

    try {
      const res = await fetch(`/api/v1/contacts/upload/${activeClient.id}`, {
        method: 'POST',
        headers: getAuthHeaders(), // Will append X-User-Role and X-Client-Id
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        showStatus('success', `בהצלחה! ייבאנו בהצלחה ${data.imported_count} אנשי קשר מתוך קובץ ה-CSV!`);
        setShowUploadModal(false);
        setSelectedCsvFile(null);
        fetchTenantData();
      } else {
        const errData = await res.json();
        showStatus('error', errData.detail || 'שגיאה בהעלאת קובץ ה-CSV');
      }
    } catch {
      showStatus('error', 'שגיאה בתקשורת מול השרת בעת העלאת קובץ ה-CSV');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleOptStatus = async (contactId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'granted' ? 'revoked' : 'granted';
    try {
      const res = await fetch(`/api/v1/contacts/${contactId}/opt-status?opt_status=${nextStatus}`, {
        method: 'PUT',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        setContacts(prev => prev.map(c => c.id === contactId ? { ...c, opt_in_status: nextStatus as any } : c));
        // If simulated user view is open for this contact, update its opt-in status immediately too
        if (simulatedContact && simulatedContact.id === contactId) {
          setSimulatedContact(prev => prev ? { ...prev, opt_in_status: nextStatus as any } : null);
        }
        showStatus('success', 'סטטוס אישור דיוור עודכן בהצלחה!');
      } else {
        const err = await res.json();
        showStatus('error', err.detail || 'שגיאה בעדכון הרשאות הדיוור');
      }
    } catch (err) {
      console.error('Failed to toggle opt-in status:', err);
    }
  };

  const handleCreateCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeClient || !campName || !campTemplate) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/campaigns/${activeClient.id}`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          client_id: activeClient.id,
          name: campName,
          template_name: campTemplate,
          template_language: campLang
        })
      });
      if (res.ok) {
        const newCamp = await res.json();
        setCampaigns(prev => [newCamp, ...prev]);
        setCampName('');
        showStatus('success', 'קמפיין חדש נוצר כטיוטה בהצלחה!');
      } else {
        const err = await res.json();
        showStatus('error', err.detail || 'שגיאה ביצירת קמפיין חדש');
      }
    } catch {
      showStatus('error', 'שגיאה ביצירת קמפיין חדש');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDispatchCampaign = async (campaignId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/campaigns/${campaignId}/dispatch`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      if (res.ok) {
        showStatus('success', 'הקמפיין נשלח לתור העבודה והחל תהליך השידור!');
        fetchTenantData();
      } else {
        const errData = await res.json();
        showStatus('error', errData.detail || 'שגיאה בשידור הקמפיין');
      }
    } catch {
      showStatus('error', 'תקשורת נכשלה בעת ניסיון שידור');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectCampaign = async (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    try {
      const res = await fetch(`/api/v1/campaigns/${campaign.id}/messages`, {
        headers: getAuthHeaders()
      });
      if (res.ok) {
        const data = await res.json();
        setSelectedCampaignMessages(data);
      }
    } catch (err) {
      console.error('Failed to load message logs:', err);
    }
  };

  const showStatus = (type: 'success' | 'error', text: string) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg(null), 5000);
  };

  // Mock Simulations (Flow B - Webhooks don't need auth headers as they mock real Incoming Meta Cloud calls)
  const handleSimulateWebhook = async (type: string, wamid?: string, phone?: string) => {
    setIsLoading(true);
    try {
      let url = `/api/v1/webhooks/simulate-webhook?event_type=${type}`;
      if (wamid) url += `&wamid=${wamid}`;
      if (phone) url += `&phone_number=${encodeURIComponent(phone)}`;

      const res = await fetch(url, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        showStatus('success', `סימולציה בוצעה: ${data.message}`);
        fetchTenantData();
        if (selectedCampaign) {
          handleSelectCampaign(selectedCampaign);
        }
      } else {
        throw new Error();
      }
    } catch {
      showStatus('error', 'שגיאה בהרצת סימולציית Webhook');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="dashboard-container" style={{ direction: 'rtl' }}>
      {/* Background radial neon lights */}
      <div className="glow-accent-1"></div>
      <div className="glow-accent-2"></div>

      {/* Sidebar (Localized in Hebrew and scoped by Role) */}
      <aside className="sidebar">
        <div>
          <div className="brand-section">
            <div className="brand-icon">{role === 'ADMIN' ? '🛡️' : '💬'}</div>
            <span className="brand-name">
              {role === 'ADMIN' ? 'ניהול על FlowsBiz' : activeClient?.name || 'פנל לקוח קצה'}
            </span>
          </div>

          {/* Admin Role - Client Impersonation Selection Dropdown */}
          {role === 'ADMIN' && (
            <div style={{ marginBottom: '1.5rem', background: 'rgba(59, 130, 246, 0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.1)' }}>
              <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-violet)', fontWeight: 600 }}>התחזות ללקוח (Tenant Context)</label>
              {clients.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--color-danger)', margin: '0.25rem 0 0 0' }}>טרם הוגדרו לקוחות</p>
              ) : (
                <select 
                  className="form-input" 
                  style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-color)', marginTop: '0.35rem', fontSize: '0.85rem' }}
                  value={activeClient?.id || ''}
                  onChange={(e) => {
                    const target = clients.find(c => c.id === e.target.value);
                    if (target) setActiveClient(target);
                  }}
                >
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              )}
            </div>
          )}

          {role === 'CLIENT' && activeClient && (
            <div style={{ marginBottom: '1.5rem', background: 'rgba(16, 185, 129, 0.05)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.1)' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-success)', fontWeight: 600, display: 'block' }}>דייר פעיל ומאובטח</span>
              <strong style={{ fontSize: '0.9rem', color: 'var(--text-bright)', marginTop: '0.25rem', display: 'block' }}>
                {activeClient.name}
              </strong>
              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>מזהה: <code>{activeClient.id.substring(0, 8)}...</code></span>
            </div>
          )}

          <ul className="nav-menu">
            {/* 1. Campaigns & Sends Menu (Available to both Admin and Client) */}
            <li 
              className={`nav-item ${activeMenu === 'campaigns' ? 'active' : ''}`}
              onClick={() => setActiveMenu('campaigns')}
            >
              <span className="nav-icon">🚀</span>
              {role === 'ADMIN' ? 'קמפיינים ושידורים' : 'הקמפיינים שלי'}
            </li>

            {/* 2. Contacts Management (Available to both Admin and Client) */}
            <li 
              className={`nav-item ${activeMenu === 'contacts' ? 'active' : ''}`}
              onClick={() => setActiveMenu('contacts')}
            >
              <span className="nav-icon">👥</span>
              {role === 'ADMIN' ? 'ניהול אנשי קשר' : 'ייבוא וניהול אנשי קשר'}
            </li>

            {/* 3. Client Registration/CRUD (ADMIN Role Only) */}
            {role === 'ADMIN' && (
              <li 
                className={`nav-item ${activeMenu === 'tenants' ? 'active' : ''}`}
                onClick={() => setActiveMenu('tenants')}
              >
                <span className="nav-icon">🏢</span>
                ניהול לקוחות (CRUD)
              </li>
            )}

            {/* 4. Global Audit Logs (ADMIN Role Only) */}
            {role === 'ADMIN' && (
              <li 
                className={`nav-item ${activeMenu === 'globalAudits' ? 'active' : ''}`}
                onClick={() => setActiveMenu('globalAudits')}
              >
                <span className="nav-icon">📜</span>
                לוגי אבטחה גלובליים
              </li>
            )}

            {/* 5. Simulated User preference view (Available to both) */}
            <li 
              className={`nav-item ${activeMenu === 'userView' ? 'active' : ''}`}
              onClick={() => setActiveMenu('userView')}
            >
              <span className="nav-icon">📱</span>
              {role === 'ADMIN' ? 'סימולטור צד משתמש קצה' : 'תיבת צ\'אט / Inbox מובייל'}
            </li>

            {/* 6. Webhooks simulator (ADMIN Role Only) */}
            {role === 'ADMIN' && (
              <li 
                className={`nav-item ${activeMenu === 'simulator' ? 'active' : ''}`}
                onClick={() => setActiveMenu('simulator')}
              >
                <span className="nav-icon">🛠️</span>
                סימולטור אירועים (Flow B)
              </li>
            )}
          </ul>
        </div>

        <div className="sidebar-footer">
          <span className="version-pill">Multi-Tenancy PWA Engine</span>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="main-content">
        <header className="main-header" style={{ flexWrap: 'wrap', gap: '1rem' }}>
          <div className="header-title">
            <h1>ניהול הפצה בוואטסאפ Cloud API</h1>
            <p>ארכיטקטורת Ports & Adapters מאובטחת ומבוזרת.</p>
          </div>

          {/* SIMULATION ROLE SWITCHER CONTROL PANEL (Premium light mode style) */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.5rem', 
              background: 'rgba(255,255,255,0.7)', 
              backdropFilter: 'blur(10px)', 
              padding: '0.45rem 0.75rem', 
              borderRadius: '30px', 
              border: '1px solid var(--border-color)',
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
            }}
          >
            <span style={{ fontSize: '0.8rem', color: 'var(--text-bright)', fontWeight: 600 }}>סימולציית תפקיד:</span>
            <button 
              className="btn" 
              style={{ 
                fontSize: '0.75rem', 
                padding: '0.35rem 0.75rem', 
                borderRadius: '20px', 
                border: 'none',
                background: role === 'ADMIN' ? 'var(--color-violet)' : 'transparent',
                color: role === 'ADMIN' ? '#ffffff' : 'var(--text-main)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => setRole('ADMIN')}
            >
              🛡️ מנהל (Admin)
            </button>
            <button 
              className="btn" 
              style={{ 
                fontSize: '0.75rem', 
                padding: '0.35rem 0.75rem', 
                borderRadius: '20px', 
                border: 'none',
                background: role === 'CLIENT' ? 'var(--color-success)' : 'transparent',
                color: role === 'CLIENT' ? '#ffffff' : 'var(--text-main)',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease'
              }}
              onClick={() => {
                if (!activeClient && clients.length > 0) {
                  setActiveClient(clients[0]);
                }
                setRole('CLIENT');
              }}
            >
              💼 לקוח (Client)
            </button>
          </div>

          <div className="status-pill">
            <span className={`status-indicator ${
              backendStatus === 'live' ? 'success' : 
              backendStatus === 'checking' ? 'warning' : 'danger'
            }`}></span>
            <span>
              {backendStatus === 'live' ? 'חיבור לשרת פעיל' : 
               backendStatus === 'checking' ? 'בודק חיבור...' : 'מנותק מהשרת'}
            </span>
          </div>
        </header>

        {statusMsg && (
          <div 
            className="glass-card" 
            style={{ 
              padding: '1rem', 
              borderColor: statusMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)',
              background: statusMsg.type === 'success' ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)'
            }}
          >
            <p style={{ fontWeight: 600, color: statusMsg.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }}>
              {statusMsg.text}
            </p>
          </div>
        )}

        {/* 1. Campaigns & Sends Menu */}
        {activeMenu === 'campaigns' && (
          <div className="content-grid" style={{ gridTemplateColumns: selectedCampaign ? '1.2fr 1fr' : '1.3fr 1fr' }}>
            
            {/* List Campaigns */}
            <section className="glass-card">
              <h2 className="section-title">📢 קמפיינים פעילים ({activeClient?.name || 'אין לקוח'})</h2>
              {campaigns.length === 0 ? (
                <div className="empty-state">
                  <span>📂</span>
                  <h3>אין קמפיינים רשומים</h3>
                  <p>צור קמפיין חדש בעזרת הטופס הצידי כדי להתחיל.</p>
                </div>
              ) : (
                <div className="items-list">
                  {campaigns.map((camp) => (
                    <div 
                      key={camp.id} 
                      className={`item-row ${selectedCampaign?.id === camp.id ? 'completed' : ''}`}
                      style={{ cursor: 'pointer', display: 'block' }}
                      onClick={() => handleSelectCampaign(camp)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <h4 style={{ color: 'var(--text-bright)', fontSize: '1.05rem' }}>{camp.name}</h4>
                          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            תבנית: <code>{camp.template_name}</code> ({camp.template_language})
                          </p>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                          <span className="version-pill" style={{ 
                            background: 
                              camp.status === 'completed' ? 'var(--color-success-glow)' : 
                              camp.status === 'processing' ? 'var(--color-warning-glow)' : 'var(--bg-tertiary)',
                            color: 
                              camp.status === 'completed' ? 'var(--color-success)' : 
                              camp.status === 'processing' ? 'var(--color-warning)' : 'var(--text-muted)'
                          }}>
                            {camp.status === 'draft' ? 'טיוטה' :
                             camp.status === 'scheduled' ? 'מתוזמן' :
                             camp.status === 'processing' ? 'משדר' :
                             camp.status === 'completed' ? 'הושלם' : 'נכשל'}
                          </span>
                          {camp.status === 'draft' && (
                            <button 
                              className="btn btn-primary" 
                              style={{ fontSize: '0.8rem', padding: '0.35rem 0.75rem' }}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDispatchCampaign(camp.id);
                              }}
                            >
                              שגר 🚀
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Campaign Mini Metrics */}
                      <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.85rem', fontSize: '0.8rem', borderTop: '1px solid rgba(255,255,255,0.03)', paddingTop: '0.5rem' }}>
                        <div>יעד פילוח: <strong>{camp.total_contacts_count}</strong></div>
                        <div style={{ color: 'var(--color-violet)' }}>נשלחו: <strong>{camp.sent_count}</strong></div>
                        <div style={{ color: 'var(--color-cyan)' }}>נמסרו: <strong>{camp.delivered_count}</strong></div>
                        <div style={{ color: 'var(--color-success)' }}>נקראו: <strong>{camp.read_count}</strong></div>
                        <div style={{ color: 'var(--color-danger)' }}>נכשלו: <strong>{camp.failed_count}</strong></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Campaign Sidebar Panel: message logs OR Create form */}
            {selectedCampaign ? (
              <section className="glass-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                  <h2 className="section-title" style={{ margin: 0 }}>📊 מעקב שידור: {selectedCampaign.name}</h2>
                  <button className="btn" style={{ fontSize: '0.8rem', background: 'var(--bg-tertiary)' }} onClick={() => setSelectedCampaign(null)}>סגור X</button>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '450px', overflowY: 'auto' }}>
                  {selectedCampaignMessages.length === 0 ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>טרם נוצרו יומני שידור עבור קמפיין זה.</p>
                  ) : (
                    selectedCampaignMessages.map(msg => (
                      <div key={msg.id} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <strong>{msg.phone_number}</strong>
                          <span style={{ 
                            color: 
                              msg.status === 'read' ? 'var(--color-success)' :
                              msg.status === 'delivered' ? 'var(--color-cyan)' :
                              msg.status === 'failed' ? 'var(--color-danger)' : 'var(--text-muted)',
                            fontWeight: 'bold'
                          }}>
                            {msg.status === 'queued' ? 'בתור לשידור' :
                             msg.status === 'sent' ? 'נשלח מ-Meta' :
                             msg.status === 'delivered' ? 'נמסר למכשיר' :
                             msg.status === 'read' ? 'נקרא' : 'נכשל'}
                          </span>
                        </div>
                        {msg.meta_message_id && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>מזהה הודעה: <code>{msg.meta_message_id}</code></span>
                            
                            {/* Webhook trigger simulator inside campaign messaging row (Visible only to Admin to keep it clean) */}
                            {role === 'ADMIN' && (
                              <div style={{ display: 'flex', gap: '0.35rem' }}>
                                {msg.status === 'sent' && (
                                  <button 
                                    className="btn" 
                                    style={{ fontSize: '0.7rem', padding: '0.1rem 0.3rem', background: 'var(--color-cyan-glow)', color: 'var(--color-cyan)' }}
                                    onClick={() => handleSimulateWebhook('status_delivered', msg.meta_message_id!)}
                                  >
                                    מסר ✔
                                  </button>
                                )}
                                {(msg.status === 'sent' || msg.status === 'delivered') && (
                                  <button 
                                    className="btn" 
                                    style={{ fontSize: '0.7rem', padding: '0.1rem 0.3rem', background: 'var(--color-success-glow)', color: 'var(--color-success)' }}
                                    onClick={() => handleSimulateWebhook('status_read', msg.meta_message_id!)}
                                  >
                                    קרא 👁
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {msg.error_code && (
                          <div style={{ color: 'var(--color-danger)', fontSize: '0.75rem', marginTop: '0.25rem' }}>
                            שגיאה: [{msg.error_code}] {msg.error_message}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </section>
            ) : (
              <section className="glass-card">
                <h2 className="section-title">➕ יצירת קמפיין חדש</h2>
                <form onSubmit={handleCreateCampaign}>
                  <div className="form-group">
                    <label className="form-label">שם הקמפיין</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="למשל: עדכון מבצעים לחג פסח" 
                      value={campName}
                      onChange={(e) => setCampName(e.target.value)}
                      required
                      disabled={!activeClient || isLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">שם תבנית רשומה ב-Meta (Registered Template)</label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="למשל: summer_promo" 
                      value={campTemplate}
                      onChange={(e) => setCampTemplate(e.target.value)}
                      required
                      disabled={!activeClient || isLoading}
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">שפת תבנית</label>
                    <select 
                      className="form-input"
                      value={campLang}
                      onChange={(e) => setCampLang(e.target.value)}
                      disabled={!activeClient || isLoading}
                    >
                      <option value="he">עברית (he)</option>
                      <option value="en">אנגלית (en)</option>
                      <option value="ar">ערבית (ar)</option>
                    </select>
                  </div>

                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    style={{ width: '100%', marginTop: '0.5rem' }}
                    disabled={!activeClient || isLoading}
                  >
                    צור קמפיין כטיוטה 💾
                  </button>
                </form>
              </section>
            )}
          </div>
        )}

        {/* 2. Contacts Management */}
        {activeMenu === 'contacts' && (
          <div className="content-grid">
            {/* List contacts */}
            <section className="glass-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
                <h2 className="section-title" style={{ marginBottom: 0, borderBottom: 'none', paddingBottom: 0 }}>👥 מאגר אנשי הקשר ומעקב דיוור</h2>
                <button 
                  className="btn btn-primary" 
                  style={{ fontSize: '0.85rem', padding: '0.5rem 1rem' }}
                  onClick={() => setShowUploadModal(true)}
                  disabled={!activeClient}
                >
                  📥 ייבוא אנשי קשר (CSV)
                </button>
              </div>
              {contacts.length === 0 ? (
                <div className="empty-state">
                  <span>👥</span>
                  <h3>אין אנשי קשר רשומים</h3>
                  <p>השתמש בטופס הצידי כדי להזין מספרי טלפון לפלח דיוור.</p>
                </div>
              ) : (
                <div className="items-list">
                  {contacts.map(c => (
                    <div key={c.id} className={`item-row ${c.opt_in_status === 'revoked' ? 'completed' : ''}`}>
                      <div className="item-details">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 'bold', color: 'var(--text-bright)' }}>{c.first_name} {c.last_name}</span>
                          <code>{c.phone_number}</code>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                          מאפיינים אישיים: <code>{JSON.stringify(c.custom_attributes)}</code>
                        </div>
                      </div>

                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span className="version-pill" style={{
                          background: c.opt_in_status === 'granted' ? 'var(--color-success-glow)' : 'var(--color-danger-glow)',
                          color: c.opt_in_status === 'granted' ? 'var(--color-success)' : 'var(--color-danger)',
                        }}>
                          {c.opt_in_status === 'granted' ? 'אישור פעיל' : 'דיוור חסום (Opt-out)'}
                        </span>

                        <button 
                          className="btn" 
                          style={{ fontSize: '0.8rem', padding: '0.25rem 0.5rem', background: 'var(--bg-tertiary)' }}
                          onClick={() => handleToggleOptStatus(c.id, c.opt_in_status)}
                        >
                          שנה סטטוס 🔁
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Create contact */}
            <section className="glass-card" style={{ height: 'fit-content' }}>
              <h2 className="section-title">➕ קליטת איש קשר חדש</h2>
              <form onSubmit={handleCreateContact}>
                <div className="form-group">
                  <label className="form-label">שם פרטי</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="למשל: משה" 
                    value={contactFirst}
                    onChange={(e) => setContactFirst(e.target.value)}
                    required
                    disabled={!activeClient || isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">שם משפחה</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="למשל: כהן" 
                    value={contactLast}
                    onChange={(e) => setContactLast(e.target.value)}
                    disabled={!activeClient || isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">מספר טלפון (פורמט E.164 בינלאומי)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="למשל: 972501234567+" 
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    required
                    disabled={!activeClient || isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">מאפיינים אישיים (JSON Object)</label>
                  <textarea 
                    className="form-textarea" 
                    value={contactAttr}
                    onChange={(e) => setContactAttr(e.target.value)}
                    required
                    disabled={!activeClient || isLoading}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  style={{ width: '100%' }}
                  disabled={!activeClient || isLoading}
                >
                  קלוט איש קשר במערכת 💾
                </button>
              </form>
            </section>
          </div>
        )}

        {/* 3. Tenants Configuration Menu (ADMIN Role Only) */}
        {activeMenu === 'tenants' && role === 'ADMIN' && (
          <div className="content-grid">
            {/* List clients */}
            <section className="glass-card">
              <h2 className="section-title">🏢 לקוחות רשומים (Multi-Tenant Hub)</h2>
              {clients.length === 0 ? (
                <div className="empty-state">
                  <span>🏢</span>
                  <h3>אין דיירים (Clients) רשומים במערכת</h3>
                  <p>מלא את הטופס הצידי כדי להגדיר מזהי וואטסאפ Cloud API עבור לקוח ראשון.</p>
                </div>
              ) : (
                <div className="items-list">
                  {clients.map(c => (
                    <div key={c.id} className="item-row" style={{ display: 'block' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <strong style={{ color: 'var(--text-bright)', fontSize: '1.05rem' }}>{c.name}</strong>
                        <span className="version-pill" style={{ background: 'var(--color-success-glow)', color: 'var(--color-success)' }}>{c.status}</span>
                      </div>
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                        <div>מזהה WABA ID: <code>{c.meta_waba_id}</code></div>
                        <div>מזהה טלפון Phone ID: <code>{c.meta_phone_number_id}</code></div>
                        <div>ח.פ / מזהה חברה: <span>{c.company_registration_number}</span></div>
                        <div>אתר אינטרנט: <span>{c.website}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Create Client (Tenant Setup Setup) */}
            <section className="glass-card">
              <h2 className="section-title">🏢 רישום דייר/לקוח (Tenant Registration)</h2>
              <form onSubmit={handleCreateClient}>
                <div className="form-group">
                  <label className="form-label">שם החברה / הלקוח</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="למשל: סטרטאפ בעמ" 
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">מספר מזהה חברה (ח.פ)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="516273849" 
                    value={clientRegNum}
                    onChange={(e) => setClientRegNum(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">אתר החברה</label>
                  <input 
                    type="url" 
                    className="form-input" 
                    placeholder="https://start.com" 
                    value={clientWeb}
                    onChange={(e) => setClientWeb(e.target.value)}
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '1rem' }}>
                  <label className="form-label">Meta WABA Account ID</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="מזהה חשבון עסקי מוואטסאפ" 
                    value={wabaId}
                    onChange={(e) => setWabaId(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Meta Phone Number ID</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="מזהה מספר טלפון מוואטסאפ" 
                    value={phoneId}
                    onChange={(e) => setPhoneId(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Meta permanent Access Token</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="עבור פיתוח מקומי הזן mock_token" 
                    value={accessToken}
                    onChange={(e) => setAccessToken(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={isLoading}>
                  רשום דייר חדש במערכת 🏢
                </button>
              </form>
            </section>
          </div>
        )}

        {/* 4. Global Security Audit Logs (ADMIN Role Only) */}
        {activeMenu === 'globalAudits' && role === 'ADMIN' && (
          <div className="content-grid" style={{ gridTemplateColumns: '1fr' }}>
            <section className="glass-card">
              <h2 className="section-title">🛡️ לוגי אבטחה ומעקב גלובליים (Global SaaS Audits)</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1.5rem' }}>
                תצוגה מרוכזת של כלל יומני הפעילות עבור מנהלי מערכת. מציג פעולות יבוא, הסרות דיוור ושידורי קמפיינים בכלל הדיירים.
              </p>
              
              <div className="items-list" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                {globalAudits.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '3rem 0' }}>טרם נרשמו פעולות מערכת גלובליות.</p>
                ) : (
                  globalAudits.map(audit => {
                    const clientName = clients.find(c => c.id === audit.client_id)?.name || `Client [${audit.client_id.substring(0,8)}]`;
                    return (
                      <div key={audit.id} className="item-row" style={{ display: 'block', padding: '1rem', background: 'rgba(0, 0, 0, 0.01)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <span className="version-pill" style={{ background: 'var(--color-violet-glow)', color: 'var(--color-violet)', fontSize: '0.75rem', marginLeft: '0.5rem' }}>
                              {audit.action}
                            </span>
                            <span style={{ fontSize: '0.85rem', color: 'var(--text-bright)', fontWeight: 600 }}>
                              שם לקוח: {clientName}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {new Date(audit.timestamp).toLocaleString('he-IL')}
                          </span>
                        </div>
                        <div style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                          מפעיל (Actor): <code>{audit.actor}</code>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.6)', border: '1px solid var(--border-color)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.5rem', fontSize: '0.75rem', overflowX: 'auto' }}>
                          <code>{JSON.stringify(audit.payload)}</code>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </section>
          </div>
        )}

        {/* 5. API & Webhook Simulation Center (ADMIN Role Only) */}
        {activeMenu === 'simulator' && role === 'ADMIN' && (
          <div className="content-grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <section className="glass-card">
              <h2 className="section-title">🛠️ סימולטור אירועי Webhooks מוואטסאפ (Flow B)</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
                באזור זה ניתן לסמלץ הגעה של callbacks משרתי פייסבוק על מנת לבחון את המערכת ללא צורך בהקמת שרת HTTPS או רכישת קווים אמיתיים מוואטסאפ.
              </p>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Simulator Option 1: Unsubscribe */}
                <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--color-danger)', marginBottom: '0.5rem' }}>הסרת דיוור נכנסת (Opt-out Simulation)</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                    מסמלץ מצב בו משתמש הקצה השיב להודעה שקיבל ורשם "הסר". המערכת תקלוט זאת ב-Webhook ותבצע Opt-out מיידי.
                  </p>
                  
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <select 
                      className="form-input"
                      style={{ fontSize: '0.85rem' }}
                      id="sim-unsub-phone"
                    >
                      {contacts.map(c => (
                        <option key={c.id} value={c.phone_number}>{c.first_name} ({c.phone_number})</option>
                      ))}
                    </select>
                    <button 
                      className="btn"
                      style={{ background: 'var(--color-danger-glow)', color: 'var(--color-danger)', fontSize: '0.85rem' }}
                      onClick={() => {
                        const selectEl = document.getElementById('sim-unsub-phone') as HTMLSelectElement;
                        if (selectEl?.value) {
                          handleSimulateWebhook('user_unsubscribe', undefined, selectEl.value);
                        } else {
                          showStatus('error', 'לא נבחרו אנשי קשר לסימולציה');
                        }
                      }}
                    >
                      סמלץ "הסר" 🛑
                    </button>
                  </div>
                </div>

                {/* Simulator Option 2: Status Webhooks info */}
                <div style={{ padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--color-cyan)', marginBottom: '0.5rem' }}>סימולציית סטטוס שידור (Delivered / Read)</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    כדי לבדוק מסירה או קריאה של הודעות, עבור ללשונית "קמפיינים ושידורים", בחר את הקמפיין הרצוי, ולחץ על הלחצנים הייעודיים ליד כל מזהה הודעה ברשימה הצידית.
                  </p>
                </div>
              </div>
            </section>

            {/* Audit Logs Trail view (Tenant Spacific logs) */}
            <section className="glass-card">
              <h2 className="section-title">📜 יומן מעקב פעולות וביקורת לקוח ({activeClient?.name})</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', maxHeight: '450px', overflowY: 'auto' }}>
                {audits.length === 0 ? (
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', textAlign: 'center', padding: '2rem 0' }}>טרם נרשמו פעולות במערכת.</p>
                ) : (
                  audits.map(audit => (
                    <div key={audit.id} style={{ padding: '0.75rem', background: 'rgba(0,0,0,0.02)', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.8rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span style={{ color: 'var(--color-violet)' }}>{audit.action}</span>
                        <span style={{ color: 'var(--text-muted)' }}>{new Date(audit.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        מפעיל: <code>{audit.actor}</code>
                      </div>
                      <div style={{ background: 'rgba(255,255,255,0.6)', padding: '0.35rem', borderRadius: '4px', marginTop: '0.35rem', fontSize: '0.75rem', border: '1px solid var(--border-color)' }}>
                        <code>{JSON.stringify(audit.payload)}</code>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        {/* 6. User End-User View & WhatsApp Mobile Mockup Chat Simulator (Preference center / Simulator) */}
        {activeMenu === 'userView' && (
          <div className="content-grid" style={{ gridTemplateColumns: '1.2fr 1fr' }}>
            {/* Left Column: User Preference Portal Mockup */}
            <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem', height: 'fit-content' }}>
              <h2 className="section-title">🌐 פורטל העדפות משתמש במובייל (Preference Center)</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: '1rem' }}>
                זהו דף האינטרנט הייעודי המותאם למכשירים ניידים, שמשתמש הקצה מגיע אליו כאשר הוא לוחץ על הקישור הכלול בהודעת הוואטסאפ שלו כדי לנהל את הרשאות הדיוור.
              </p>

              {simulatedContact ? (
                <div className="pref-portal-card" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                  <div className="pref-portal-header">
                    <h3>מרכז העדפות תקשורת</h3>
                    <p>מנוהל ומאובטח על ידי {activeClient?.name}</p>
                  </div>
                  
                  <div className="pref-portal-body">
                    <div className="pref-field-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <strong style={{ color: 'var(--text-bright)' }}>שם פרטי:</strong>
                      <span style={{ color: 'var(--text-main)' }}>{simulatedContact.first_name}</span>
                    </div>
                    <div className="pref-field-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <strong style={{ color: 'var(--text-bright)' }}>שם משפחה:</strong>
                      <span style={{ color: 'var(--text-main)' }}>{simulatedContact.last_name || 'לא הוגדר'}</span>
                    </div>
                    <div className="pref-field-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <strong style={{ color: 'var(--text-bright)' }}>מספר טלפון:</strong>
                      <span style={{ color: 'var(--text-main)' }}>{simulatedContact.phone_number}</span>
                    </div>
                    <div className="pref-field-row" style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <strong style={{ color: 'var(--text-bright)' }}>מצב מנוי וואטסאפ:</strong>
                      <span className="version-pill" style={{
                        background: simulatedContact.opt_in_status === 'granted' ? 'var(--color-success-glow)' : 'var(--color-danger-glow)',
                        color: simulatedContact.opt_in_status === 'granted' ? 'var(--color-success)' : 'var(--color-danger)',
                        fontWeight: 'bold',
                        fontSize: '0.8rem'
                      }}>
                        {simulatedContact.opt_in_status === 'granted' ? 'אישור דיוור פעיל' : 'דיוור חסום (Opt-out)'}
                      </span>
                    </div>

                    <div style={{ marginTop: 'auto', paddingTop: '1.5rem', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <button 
                        className="btn" 
                        style={{
                          width: '100%',
                          background: simulatedContact.opt_in_status === 'granted' ? 'var(--color-danger-glow)' : 'var(--color-success-glow)',
                          color: simulatedContact.opt_in_status === 'granted' ? 'var(--color-danger)' : 'var(--color-success)',
                          border: `1px solid ${simulatedContact.opt_in_status === 'granted' ? 'var(--color-danger)' : 'var(--color-success)'}`
                        }}
                        onClick={() => handleToggleOptStatus(simulatedContact.id, simulatedContact.opt_in_status)}
                      >
                        {simulatedContact.opt_in_status === 'granted' ? '🛑 חסום דיוור מוואטסאפ' : '✅ אפשר דיוור מחדש'}
                      </button>
                      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'center', marginTop: '0.5rem' }}>
                        שינוי זה מעדכן באופן מיידי את סטטוס אנשי הקשר שלך במערכת הניהול לצרכי ציות לחוקי ספאם.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>לא נבחר איש קשר לסימולציה. הוסף איש קשר בניהול אנשי הקשר.</p>
              )}
            </section>

            {/* Right Column: WhatsApp Mobile Chat Simulator Mockup */}
            <section className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h2 className="section-title">📱 סימולטור צ'אט וואטסאפ במובייל</h2>
              
              <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <label className="form-label" style={{ margin: 0, fontSize: '0.85rem' }}>הצג צ'אט עבור:</label>
                <select 
                  className="form-input" 
                  style={{ width: 'auto', padding: '0.35rem 0.75rem', fontSize: '0.85rem' }}
                  value={simulatedContact?.id || ''}
                  onChange={(e) => {
                    const target = contacts.find(c => c.id === e.target.value);
                    if (target) setSimulatedContact(target);
                  }}
                >
                  {contacts.map(c => (
                    <option key={c.id} value={c.id}>{c.first_name} ({c.phone_number})</option>
                  ))}
                </select>
              </div>

              {simulatedContact && activeClient ? (
                <div className="phone-mockup">
                  <div className="phone-notch"></div>
                  
                  {/* WhatsApp Mobile header */}
                  <div className="phone-header">
                    <span className="phone-back-arrow" style={{ transform: 'rotate(180deg)', display: 'inline-block' }}>➔</span>
                    <div className="phone-avatar">
                      {activeClient.name.substring(0, 1).toUpperCase()}
                    </div>
                    <div className="phone-biz-info">
                      <span className="phone-biz-name">
                        {activeClient.name}
                        <span className="phone-verified-badge" title="Verified business status">✔</span>
                      </span>
                      <span className="phone-biz-status">מחובר (Online)</span>
                    </div>
                  </div>

                  {/* Chat message logs body */}
                  <div className="phone-chat-body">
                    <div className="phone-date-separator">היום</div>
                    
                    {simulatedChatMessages.map((chat, idx) => (
                      <div key={idx} className={`phone-msg-bubble ${chat.sender}`}>
                        <div style={{ whiteSpace: 'pre-line' }}>{chat.text}</div>
                        
                        {/* If it's a template from the business, show active button mockups */}
                        {chat.sender === 'business' && idx === 0 && (
                          <div className="phone-msg-button-action">
                            <button 
                              className="phone-action-btn"
                              onClick={() => {
                                setSimulatedChatMessages(prev => [...prev, {
                                  sender: 'user',
                                  text: 'הסר',
                                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                }]);
                                handleSimulateWebhook('user_unsubscribe', undefined, simulatedContact.phone_number);
                                setTimeout(() => {
                                  setSimulatedChatMessages(prev => [...prev, {
                                    sender: 'business',
                                    text: `הסרת הדיוור בוצעה בהצלחה. לא יישלחו אליך הודעות נוספות מ-${activeClient.name}. לשירותך תמיד!`,
                                    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                  }]);
                                }, 1000);
                              }}
                            >
                              🛑 הסר דיוור (Opt-out)
                            </button>
                            <button 
                              className="phone-action-btn"
                              style={{ color: '#3b82f6' }}
                              onClick={() => setActiveMenu('userView')}
                            >
                              🌐 פורטל העדפות
                            </button>
                          </div>
                        )}

                        <span className="phone-msg-time">
                          {chat.time}
                          {chat.sender === 'business' && (
                            <span className="phone-msg-double-tick">✔✔</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Keyboard input footer */}
                  <form className="phone-footer" onSubmit={handleSendSimulatedChat}>
                    <div className="phone-input-container" style={{ background: '#ffffff', border: '1px solid var(--border-color)' }}>
                      <span>😀</span>
                      <input 
                        type="text" 
                        className="phone-input-field" 
                        placeholder="הקלד הודעה... (נסה 'הסר')" 
                        value={chatInputText}
                        onChange={(e) => setChatInputText(e.target.value)}
                        style={{ color: '#000000' }}
                      />
                      <span>📎</span>
                    </div>
                    <button type="submit" className="phone-send-btn">➔</button>
                  </form>
                </div>
              ) : (
                <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>לא נמצאו אנשי קשר לסימולציה.</p>
              )}
            </section>
          </div>
        )}
      </main>

      {/* 7. Drag & Drop CSV Importer Modal */}
      {showUploadModal && activeClient && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(15, 23, 42, 0.4)',
          backdropFilter: 'blur(4px)',
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div className="glass-card" style={{
            width: '450px',
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            padding: '2rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-bright)' }}>📥 ייבוא אנשי קשר מקובץ CSV</h3>
              <button 
                className="btn" 
                style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-muted)' }}
                onClick={() => { setShowUploadModal(false); setSelectedCsvFile(null); }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
              העלה קובץ פסיקים (CSV). המערכת תסרוק את העמודות באופן אוטומטי, תנרמל את מספרי הטלפון לפורמט E.164, ותמפה עמודות דינמיות נוספות ל-Custom Attributes של איש הקשר.
            </p>

            <form onSubmit={handleCsvUpload} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Drag and Drop Region */}
              <div 
                style={{
                  border: `2px dashed ${isDragging ? 'var(--color-violet)' : 'var(--border-color)'}`,
                  backgroundColor: isDragging ? 'var(--color-violet-glow)' : 'var(--bg-primary)',
                  borderRadius: 'var(--radius-md)',
                  padding: '2.5rem 1.5rem',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragging(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const file = e.dataTransfer.files[0];
                    if (file.name.endsWith('.csv')) {
                      setSelectedCsvFile(file);
                    } else {
                      showStatus('error', 'שגיאה: ניתן להעלות קבצי CSV בלבד');
                    }
                  }
                }}
                onClick={() => document.getElementById('csv-file-input')?.click()}
              >
                <input 
                  type="file" 
                  id="csv-file-input" 
                  accept=".csv" 
                  style={{ display: 'none' }} 
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      setSelectedCsvFile(e.target.files[0]);
                    }
                  }}
                />
                
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📄</div>
                {selectedCsvFile ? (
                  <div>
                    <strong style={{ color: 'var(--text-bright)', fontSize: '0.9rem' }}>{selectedCsvFile.name}</strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      ({Math.round(selectedCsvFile.size / 1024)} KB)
                    </p>
                  </div>
                ) : (
                  <div>
                    <strong style={{ color: 'var(--text-bright)', fontSize: '0.9rem' }}>גרור והשלך קובץ CSV כאן</strong>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                      או לחץ לבחירת קובץ מהמחשב
                    </p>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
                <button 
                  type="button" 
                  className="btn" 
                  style={{ background: 'var(--bg-tertiary)', color: 'var(--text-main)' }}
                  onClick={() => { setShowUploadModal(false); setSelectedCsvFile(null); }}
                  disabled={isLoading}
                >
                  ביטול
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={!selectedCsvFile || isLoading}
                >
                  {isLoading ? 'מייבא...' : 'התחל בייבוא 📥'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
