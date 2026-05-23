const LifeLink = (() => {
  const tokenKey = 'lifelink_token';
  const userKey = 'lifelink_user';
  const languageKey = 'lifelink_language';
  const apiBase = (window.LIFELINK_API_BASE || '').replace(/\/$/, '');
  const translations = {
    hi: {
      'LifeLink': 'LifeLink',
      'Hospital OS': 'Hospital OS',
      'Hospital Workspace': 'Hospital Workspace',
      'Enterprise healthcare dashboard': 'Enterprise healthcare dashboard',
      'Dashboard': 'डैशबोर्ड',
      'Hospital Profile': 'अस्पताल प्रोफाइल',
      'Search Donors': 'डोनर खोजें',
      'Search Donor': 'डोनर खोजें',
      'Blood Requests': 'ब्लड रिक्वेस्ट',
      'Emergency Requests': 'इमरजेंसी रिक्वेस्ट',
      'Blood Inventory': 'ब्लड इन्वेंटरी',
      'Rare Blood Groups': 'रेयर ब्लड ग्रुप',
      'Appointments': 'अपॉइंटमेंट',
      'Donation Records': 'डोनेशन रिकॉर्ड',
      'Nearby Centers': 'नजदीकी सेंटर',
      'Smart Donor Matching': 'स्मार्ट डोनर मैचिंग',
      'Smart Matching': 'स्मार्ट मैचिंग',
      'Live Tracking': 'लाइव ट्रैकिंग',
      'Notifications': 'नोटिफिकेशन',
      'Chat System': 'चैट सिस्टम',
      'Reports & Analytics': 'रिपोर्ट और एनालिटिक्स',
      'Reports': 'रिपोर्ट',
      'AI Prediction': 'AI प्रेडिक्शन',
      'Subscription Plan': 'सब्सक्रिप्शन प्लान',
      'Subscription': 'सब्सक्रिप्शन',
      'Payment History': 'पेमेंट हिस्ट्री',
      'Payments': 'पेमेंट',
      'Invoices': 'इनवॉइस',
      'Staff Management': 'स्टाफ मैनेजमेंट',
      'Staff': 'स्टाफ',
      'Branch Management': 'ब्रांच मैनेजमेंट',
      'Branches': 'ब्रांच',
      'Settings': 'सेटिंग्स',
      'Support': 'सपोर्ट',
      'Logout': 'लॉगआउट',
      'Profile': 'प्रोफाइल',
      'View Profile': 'प्रोफाइल देखें',
      'Help Center': 'हेल्प सेंटर',
      'Current Branch': 'वर्तमान ब्रांच',
      'Hospital command center': 'अस्पताल कमांड सेंटर',
      'Welcome Back,': 'वापसी पर स्वागत है,',
      'Active Subscription': 'एक्टिव सब्सक्रिप्शन',
      'Emergency Request': 'इमरजेंसी रिक्वेस्ट',
      'Add Blood Request': 'ब्लड रिक्वेस्ट जोड़ें',
      'Add Inventory': 'इन्वेंटरी जोड़ें',
      'Live stock': 'लाइव स्टॉक',
      'Manage Inventory': 'इन्वेंटरी मैनेज करें',
      'Real-time triage': 'रियल टाइम ट्रायेज',
      'Emergency Blood Alerts': 'इमरजेंसी ब्लड अलर्ट',
      'Broadcast All': 'सबको ब्रॉडकास्ट करें',
      'AI ranked': 'AI रैंकिंग',
      'Alert Donors': 'डोनर अलर्ट करें',
      'Live Donor Map': 'लाइव डोनर मैप',
      'Today': 'आज',
      'Create Appointment': 'अपॉइंटमेंट बनाएं',
      'Live feed': 'लाइव फीड',
      'Requests': 'रिक्वेस्ट',
      'Recent Blood Requests': 'हाल की ब्लड रिक्वेस्ट',
      'Executive analytics': 'एक्जीक्यूटिव एनालिटिक्स',
      'Export PDF': 'PDF एक्सपोर्ट करें',
      'Monthly Blood Donation': 'मासिक ब्लड डोनेशन',
      'Blood Usage Analytics': 'ब्लड यूसेज एनालिटिक्स',
      'Emergency Analytics': 'इमरजेंसी एनालिटिक्स',
      'Blood Group Demand': 'ब्लड ग्रुप डिमांड',
      'Donor Availability': 'डोनर उपलब्धता',
      'Revenue Graph': 'रेवेन्यू ग्राफ',
      'Hospital Performance': 'अस्पताल परफॉर्मेंस',
      'Shortage Forecast': 'कमी का अनुमान',
      'Billing': 'बिलिंग',
      'Subscription Status': 'सब्सक्रिप्शन स्टेटस',
      'Operations': 'ऑपरेशंस',
      'Quick Actions': 'क्विक एक्शन',
      'Find Donor': 'डोनर खोजें',
      'Update Blood Stock': 'ब्लड स्टॉक अपडेट करें',
      'Generate Report': 'रिपोर्ट बनाएं',
      'Send Donor Alert': 'डोनर अलर्ट भेजें',
      'Add Staff': 'स्टाफ जोड़ें',
      'Upgrade Subscription': 'सब्सक्रिप्शन अपग्रेड करें',
      'Audit trail': 'ऑडिट ट्रेल',
      'Recent Activity Log': 'हाल की गतिविधि',
      'Administration': 'एडमिनिस्ट्रेशन',
      'Admin Dashboard': 'एडमिन डैशबोर्ड',
      'User Management': 'यूजर मैनेजमेंट',
      'Donor Management': 'डोनर मैनेजमेंट',
      'Patient Management': 'पेशेंट मैनेजमेंट',
      'Hospital Management': 'अस्पताल मैनेजमेंट',
      'Blood Bank Management': 'ब्लड बैंक मैनेजमेंट',
      'Notification Management': 'नोटिफिकेशन मैनेजमेंट',
      'Analytics Dashboard': 'एनालिटिक्स डैशबोर्ड',
      'Admin Settings': 'एडमिन सेटिंग्स',
      'Refresh': 'रिफ्रेश',
      'Export': 'एक्सपोर्ट',
      'Create': 'बनाएं',
      'Search': 'खोजें',
      'View': 'देखें',
      'Edit': 'एडिट',
      'Delete': 'डिलीट',
      'Save': 'सेव',
      'Close': 'बंद करें',
      'Cancel': 'कैंसल',
      'Previous': 'पिछला',
      'Next': 'अगला',
      'All statuses': 'सभी स्टेटस',
      'All accounts': 'सभी अकाउंट',
      'Active': 'एक्टिव',
      'Banned': 'बैन',
      'Pending': 'पेंडिंग',
      'Approved': 'अप्रूव्ड',
      'Rejected': 'रिजेक्टेड',
      'Completed': 'कम्प्लीटेड',
      'Failed': 'फेल्ड',
      'Cancelled': 'कैंसल्ड',
      'Login': 'लॉगिन',
      'Email or mobile': 'ईमेल या मोबाइल',
      'Password': 'पासवर्ड',
      'Create an account': 'अकाउंट बनाएं',
      'Register': 'रजिस्टर',
      'Name': 'नाम',
      'Email': 'ईमेल',
      'Mobile': 'मोबाइल',
      'Role': 'रोल',
      'Blood group': 'ब्लड ग्रुप',
      'City': 'शहर',
      'Search donors, requests, appointments': 'डोनर, रिक्वेस्ट, अपॉइंटमेंट खोजें'
    },
    pa: {
      'Dashboard': 'ਡੈਸ਼ਬੋਰਡ',
      'Hospital Profile': 'ਹਸਪਤਾਲ ਪ੍ਰੋਫਾਈਲ',
      'Search Donors': 'ਡੋਨਰ ਲੱਭੋ',
      'Blood Requests': 'ਖੂਨ ਬੇਨਤੀਆਂ',
      'Emergency Requests': 'ਐਮਰਜੈਂਸੀ ਬੇਨਤੀਆਂ',
      'Blood Inventory': 'ਖੂਨ ਇਨਵੈਂਟਰੀ',
      'Appointments': 'ਅਪਾਇੰਟਮੈਂਟ',
      'Notifications': 'ਨੋਟੀਫਿਕੇਸ਼ਨ',
      'Settings': 'ਸੈਟਿੰਗਾਂ',
      'Support': 'ਸਹਾਇਤਾ',
      'Logout': 'ਲਾਗਆਉਟ',
      'Welcome Back,': 'ਵਾਪਸੀ ਤੇ ਸਵਾਗਤ ਹੈ,',
      'Emergency Request': 'ਐਮਰਜੈਂਸੀ ਬੇਨਤੀ',
      'Search Donor': 'ਡੋਨਰ ਲੱਭੋ',
      'Add Blood Request': 'ਖੂਨ ਬੇਨਤੀ ਜੋੜੋ',
      'Add Inventory': 'ਇਨਵੈਂਟਰੀ ਜੋੜੋ',
      'Refresh': 'ਰਿਫ੍ਰੈਸ਼',
      'Export': 'ਐਕਸਪੋਰਟ',
      'Create': 'ਬਣਾਓ',
      'View': 'ਵੇਖੋ',
      'Edit': 'ਸੋਧੋ',
      'Delete': 'ਮਿਟਾਓ',
      'Save': 'ਸੇਵ',
      'Cancel': 'ਰੱਦ',
      'Login': 'ਲਾਗਿਨ',
      'Email or mobile': 'ਈਮੇਲ ਜਾਂ ਮੋਬਾਈਲ',
      'Password': 'ਪਾਸਵਰਡ',
      'Register': 'ਰਜਿਸਟਰ'
    }
  };

  Object.assign(translations.hi, {
    'Features': 'फीचर्स',
    'About': 'हमारे बारे में',
    'Contact': 'संपर्क',
    'Privacy': 'प्राइवेसी',
    'Terms': 'नियम',
    'Search Donor': 'डोनर खोजें',
    'Subscriptions': 'सब्सक्रिप्शन',
    'Dashboards': 'डैशबोर्ड',
    'Login': 'लॉगिन',
    'Register': 'रजिस्टर',
    'Join LifeLink': 'LifeLink से जुड़ें',
    'Start saving lives': 'जीवन बचाना शुरू करें',
    'Open dashboard': 'डैशबोर्ड खोलें',
    'Contact us': 'संपर्क करें',
    'Contact LifeLink': 'LifeLink से संपर्क करें',
    'Reach the LifeLink team': 'LifeLink टीम से संपर्क करें',
    'Phone': 'फोन',
    'Email': 'ईमेल',
    'Facebook': 'फेसबुक',
    'Instagram': 'इंस्टाग्राम',
    'Send message': 'संदेश भेजें',
    'Your name': 'आपका नाम',
    'Your email': 'आपका ईमेल',
    'Phone number': 'फोन नंबर',
    'Message': 'संदेश',
    'About LifeLink': 'LifeLink के बारे में',
    'Our mission': 'हमारा मिशन',
    'Privacy Policy': 'प्राइवेसी पॉलिसी',
    'Terms of Service': 'सेवा की शर्तें',
    'Dashboard': 'डैशबोर्ड',
    'Donor Dashboard': 'डोनर डैशबोर्ड',
    'Hospital Dashboard': 'हॉस्पिटल डैशबोर्ड',
    'Admin Dashboard': 'एडमिन डैशबोर्ड',
    'Patient Dashboard': 'पेशेंट डैशबोर्ड',
    'Blood Bank Dashboard': 'ब्लड बैंक डैशबोर्ड',
    'NGO Dashboard': 'NGO डैशबोर्ड',
    'Settings': 'सेटिंग्स',
    'Support': 'सहायता',
    'Logout': 'लॉगआउट',
    'Search': 'खोजें',
    'Refresh': 'रीफ्रेश',
    'Export': 'एक्सपोर्ट',
    'Create': 'बनाएं',
    'Save': 'सेव करें',
    'Cancel': 'रद्द करें',
    'Delete': 'डिलीट',
    'Edit': 'एडिट',
    'View': 'देखें',
    'Notifications': 'नोटिफिकेशन',
    'Emergency Request': 'इमरजेंसी रिक्वेस्ट',
    'Blood Requests': 'ब्लड रिक्वेस्ट',
    'Blood Inventory': 'ब्लड इन्वेंटरी',
    'Appointments': 'अपॉइंटमेंट',
    'Reports': 'रिपोर्ट्स',
    'Analytics': 'एनालिटिक्स',
    'Payments': 'पेमेंट्स',
    'Subscription': 'सब्सक्रिप्शन',
    'Profile': 'प्रोफाइल',
    'Health Tracker': 'हेल्थ ट्रैकर',
    'Nearby Hospitals': 'नजदीकी हॉस्पिटल',
    'Blood Camps': 'ब्लड कैंप',
    'Rewards': 'रिवॉर्ड्स',
    'Wallet': 'वॉलेट',
    'Referrals': 'रेफरल्स',
    'Chat': 'चैट'
  });

  Object.assign(translations.pa, {
    'Features': 'ਫੀਚਰ',
    'About': 'ਸਾਡੇ ਬਾਰੇ',
    'Contact': 'ਸੰਪਰਕ',
    'Privacy': 'ਪਰਾਈਵੇਸੀ',
    'Terms': 'ਸ਼ਰਤਾਂ',
    'Search Donor': 'ਡੋਨਰ ਲੱਭੋ',
    'Subscriptions': 'ਸਬਸਕ੍ਰਿਪਸ਼ਨ',
    'Dashboards': 'ਡੈਸ਼ਬੋਰਡ',
    'Login': 'ਲਾਗਇਨ',
    'Register': 'ਰਜਿਸਟਰ',
    'Join LifeLink': 'LifeLink ਨਾਲ ਜੁੜੋ',
    'Start saving lives': 'ਜੀਵਨ ਬਚਾਉਣਾ ਸ਼ੁਰੂ ਕਰੋ',
    'Open dashboard': 'ਡੈਸ਼ਬੋਰਡ ਖੋਲ੍ਹੋ',
    'Contact us': 'ਸੰਪਰਕ ਕਰੋ',
    'Contact LifeLink': 'LifeLink ਨਾਲ ਸੰਪਰਕ ਕਰੋ',
    'Reach the LifeLink team': 'LifeLink ਟੀਮ ਨਾਲ ਸੰਪਰਕ ਕਰੋ',
    'Phone': 'ਫੋਨ',
    'Email': 'ਈਮੇਲ',
    'Facebook': 'ਫੇਸਬੁੱਕ',
    'Instagram': 'ਇੰਸਟਾਗ੍ਰਾਮ',
    'Send message': 'ਸੁਨੇਹਾ ਭੇਜੋ',
    'Your name': 'ਤੁਹਾਡਾ ਨਾਮ',
    'Your email': 'ਤੁਹਾਡੀ ਈਮੇਲ',
    'Phone number': 'ਫੋਨ ਨੰਬਰ',
    'Message': 'ਸੁਨੇਹਾ',
    'About LifeLink': 'LifeLink ਬਾਰੇ',
    'Our mission': 'ਸਾਡਾ ਮਿਸ਼ਨ',
    'Privacy Policy': 'ਪਰਾਈਵੇਸੀ ਪਾਲਿਸੀ',
    'Terms of Service': 'ਸੇਵਾ ਦੀਆਂ ਸ਼ਰਤਾਂ',
    'Dashboard': 'ਡੈਸ਼ਬੋਰਡ',
    'Donor Dashboard': 'ਡੋਨਰ ਡੈਸ਼ਬੋਰਡ',
    'Hospital Dashboard': 'ਹਸਪਤਾਲ ਡੈਸ਼ਬੋਰਡ',
    'Admin Dashboard': 'ਐਡਮਿਨ ਡੈਸ਼ਬੋਰਡ',
    'Patient Dashboard': 'ਮਰੀਜ਼ ਡੈਸ਼ਬੋਰਡ',
    'Blood Bank Dashboard': 'ਬਲੱਡ ਬੈਂਕ ਡੈਸ਼ਬੋਰਡ',
    'NGO Dashboard': 'NGO ਡੈਸ਼ਬੋਰਡ',
    'Settings': 'ਸੈਟਿੰਗਾਂ',
    'Support': 'ਸਹਾਇਤਾ',
    'Logout': 'ਲਾਗਆਉਟ',
    'Search': 'ਖੋਜੋ',
    'Refresh': 'ਰਿਫ੍ਰੈਸ਼',
    'Export': 'ਐਕਸਪੋਰਟ',
    'Create': 'ਬਣਾਓ',
    'Save': 'ਸੇਵ ਕਰੋ',
    'Cancel': 'ਰੱਦ ਕਰੋ',
    'Delete': 'ਮਿਟਾਓ',
    'Edit': 'ਸੋਧੋ',
    'View': 'ਵੇਖੋ',
    'Notifications': 'ਨੋਟੀਫਿਕੇਸ਼ਨ',
    'Emergency Request': 'ਐਮਰਜੈਂਸੀ ਬੇਨਤੀ',
    'Blood Requests': 'ਖੂਨ ਬੇਨਤੀਆਂ',
    'Blood Inventory': 'ਖੂਨ ਇਨਵੈਂਟਰੀ',
    'Appointments': 'ਅਪਾਇੰਟਮੈਂਟ',
    'Reports': 'ਰਿਪੋਰਟਾਂ',
    'Analytics': 'ਐਨਾਲਿਟਿਕਸ',
    'Payments': 'ਭੁਗਤਾਨ',
    'Subscription': 'ਸਬਸਕ੍ਰਿਪਸ਼ਨ',
    'Profile': 'ਪ੍ਰੋਫਾਈਲ',
    'Health Tracker': 'ਹੈਲਥ ਟ੍ਰੈਕਰ',
    'Nearby Hospitals': 'ਨੇੜਲੇ ਹਸਪਤਾਲ',
    'Blood Camps': 'ਖੂਨ ਕੈਂਪ',
    'Rewards': 'ਇਨਾਮ',
    'Wallet': 'ਵਾਲਿਟ',
    'Referrals': 'ਰੈਫਰਲ',
    'Chat': 'ਚੈਟ'
  });

  function getToken() {
    return localStorage.getItem(tokenKey);
  }

  function getUser() {
    try {
      return JSON.parse(localStorage.getItem(userKey) || 'null');
    } catch {
      return null;
    }
  }

  function setSession(token, user) {
    localStorage.setItem(tokenKey, token);
    localStorage.setItem(userKey, JSON.stringify(user));
  }

  function logout() {
    localStorage.removeItem(tokenKey);
    localStorage.removeItem(userKey);
    location.href = '/pages/login.html';
  }

  function dashboardUrl(role) {
    const map = {
      donor: '/pages/donor/donor-dashboard.html',
      patient: '/pages/patient/patient-dashboard.html',
      hospital: '/pages/hospital/hospital-dashboard.html',
      blood_bank: '/pages/blood-bank/blood-bank-dashboard.html',
      camp_organizer: '/pages/camp-organizer/camp-organizer-dashboard.html',
      ngo: '/pages/ngo/ngo-dashboard.html',
      volunteer: '/pages/volunteer/volunteer-dashboard.html',
      admin: '/pages/admin/admin-dashboard.html',
      super_admin: '/pages/admin/admin-dashboard.html'
    };
    return map[role] || '/';
  }

  function apiUrl(path) {
    if (/^https?:\/\//i.test(path)) return path;
    return `${apiBase}${path.startsWith('/') ? path : `/${path}`}`;
  }

  function authHeaders(extra = {}) {
    const token = getToken();
    return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
  }

  async function api(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    let response;
    try {
      response = await fetch(apiUrl(path), { ...options, headers });
    } catch (error) {
      throw new Error('LifeLink server is not reachable. Start the Node.js server and refresh the page.');
    }
    const data = await response.json().catch(() => ({ message: 'Server returned an unreadable response' }));
    if (!response.ok) throw new Error(data.message || 'Something went wrong');
    return data;
  }

  function toast(message, type = 'success') {
    let zone = document.querySelector('.toast-zone');
    if (!zone) {
      zone = document.createElement('div');
      zone.className = 'toast-zone';
      document.body.appendChild(zone);
    }
    const item = document.createElement('div');
    item.className = `alert alert-${type === 'error' ? 'danger' : type} shadow-sm mb-2`;
    item.textContent = message;
    zone.appendChild(item);
    setTimeout(() => item.remove(), 4200);
  }

  function requireRole(roles) {
    const user = getUser();
    if (!getToken() || !user || !roles.includes(user.role)) {
      location.href = '/pages/login.html';
      return null;
    }
    return user;
  }

  function money(paise) {
    return `Rs ${(Number(paise || 0) / 100).toLocaleString('en-IN')}`;
  }

  function getLanguage() {
    return localStorage.getItem(languageKey) || 'en';
  }

  function setLanguage(language) {
    const normalized = normalizeLanguage(language);
    localStorage.setItem(languageKey, normalized);
    document.documentElement.lang = normalized === 'hi' ? 'hi' : normalized === 'pa' ? 'pa' : 'en';
    syncLanguageSelects();
    applyLanguage();
  }

  function normalizeLanguage(language) {
    const text = String(language || 'en').toLowerCase();
    if (text.startsWith('hi')) return 'hi';
    if (text.startsWith('pa') || text.startsWith('pu')) return 'pa';
    return 'en';
  }

  function initLanguageControls(root = document) {
    markLanguageSelects(root);
    ensureGlobalLanguageToggle();
    const selects = root.querySelectorAll('.language-select, [data-language-select]');
    selects.forEach((select) => {
      ensureLanguageOptions(select);
      select.value = getLanguage();
      if (select.dataset.languageBound) return;
      select.dataset.languageBound = 'true';
      select.addEventListener('change', () => setLanguage(select.value));
    });
    document.documentElement.lang = getLanguage();
    applyLanguage(root);
  }

  function markLanguageSelects(root = document) {
    const scope = root === document ? document : root;
    scope.querySelectorAll?.('select').forEach((select) => {
      if (select.matches('.language-select, [data-language-select]')) return;
      const values = Array.from(select.options).map((option) => normalizeLanguage(option.value || option.textContent));
      if (values.includes('en') && values.includes('hi') && values.includes('pa')) {
        select.classList.add('language-select');
        select.setAttribute('data-language-select', 'true');
        if (!select.getAttribute('aria-label')) select.setAttribute('aria-label', 'Language switch');
      }
    });
  }

  function ensureLanguageOptions(select) {
    const values = Array.from(select.options).map((option) => normalizeLanguage(option.value || option.textContent));
    const wanted = [['en', 'EN'], ['hi', 'Hindi'], ['pa', 'Punjabi']];
    if (!select.options.length || !values.includes('en')) select.innerHTML = '';
    wanted.forEach(([value, label]) => {
      if (!Array.from(select.options).some((option) => normalizeLanguage(option.value || option.textContent) === value)) {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = label;
        select.appendChild(option);
      }
    });
    Array.from(select.options).forEach((option) => {
      option.value = normalizeLanguage(option.value || option.textContent);
      if (option.value === 'en') option.textContent = 'EN';
      if (option.value === 'hi') option.textContent = 'Hindi';
      if (option.value === 'pa') option.textContent = 'Punjabi';
    });
  }

  function syncLanguageSelects() {
    markLanguageSelects();
    document.querySelectorAll('.language-select, [data-language-select]').forEach((select) => {
      ensureLanguageOptions(select);
      select.value = getLanguage();
    });
  }

  function applyLanguage(root = document) {
    const language = getLanguage();
    const dictionary = translations[language] || {};
    restoreOriginalText(root);
    if (language === 'en') return;
    translateTextNodes(root, dictionary);
    translateAttributes(root, dictionary);
  }

  function restoreOriginalText(root) {
    const scope = root === document ? document : root;
    scope.querySelectorAll?.('[data-i18n-original]').forEach((node) => {
      node.textContent = node.dataset.i18nOriginal;
    });
    scope.querySelectorAll?.('[data-i18n-placeholder]').forEach((node) => {
      node.setAttribute('placeholder', node.dataset.i18nPlaceholder);
    });
    scope.querySelectorAll?.('[data-i18n-title]').forEach((node) => {
      node.setAttribute('title', node.dataset.i18nTitle);
    });
  }

  function translateTextNodes(root, dictionary) {
    const scope = root === document ? document.body : root;
    if (!scope) return;
    const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent || ['SCRIPT', 'STYLE', 'TEXTAREA', 'INPUT', 'OPTION', 'CANVAS'].includes(parent.tagName)) return NodeFilter.FILTER_REJECT;
        if (!node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
        return NodeFilter.FILTER_ACCEPT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach((node) => {
      const original = node.parentElement.dataset.i18nOriginal || node.nodeValue;
      const translated = translateString(original, dictionary);
      if (translated !== original) {
        node.parentElement.dataset.i18nOriginal = original;
        node.nodeValue = translated;
      }
    });
  }

  function translateAttributes(root, dictionary) {
    const scope = root === document ? document : root;
    scope.querySelectorAll?.('[placeholder]').forEach((node) => {
      const original = node.dataset.i18nPlaceholder || node.getAttribute('placeholder');
      const translated = translateString(original, dictionary);
      node.dataset.i18nPlaceholder = original;
      node.setAttribute('placeholder', translated);
    });
    scope.querySelectorAll?.('[title]').forEach((node) => {
      const original = node.dataset.i18nTitle || node.getAttribute('title');
      const translated = translateString(original, dictionary);
      node.dataset.i18nTitle = original;
      node.setAttribute('title', translated);
    });
  }

  function translateString(value, dictionary) {
    let output = String(value ?? '');
    const trimmed = output.trim();
    if (dictionary[trimmed]) return output.replace(trimmed, dictionary[trimmed]);
    Object.entries(dictionary)
      .sort((a, b) => b[0].length - a[0].length)
      .forEach(([source, target]) => {
        output = output.replaceAll(source, target);
      });
    return output;
  }

  function renderRows(selector, rows, emptyText) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.innerHTML = rows.length ? rows.join('') : `<tr><td colspan="8" class="text-center text-muted py-4">${emptyText}</td></tr>`;
  }

  function initIcons() {
    if (window.lucide) window.lucide.createIcons();
  }

  function ensureGlobalLanguageToggle() {
    if (document.querySelector('.language-select, [data-language-select]') || document.querySelector('[data-lifelink-language-float]')) return;
    const floating = document.createElement('div');
    floating.className = 'lifelink-language-float';
    floating.setAttribute('data-lifelink-language-float', 'true');
    floating.innerHTML = '<i class="fa-solid fa-language" aria-hidden="true"></i><select class="form-select form-select-sm language-select" aria-label="Language switch"><option value="en">EN</option><option value="hi">Hindi</option><option value="pa">Punjabi</option></select>';
    document.body.appendChild(floating);
    ensureLanguageStyles();
  }

  function ensureLanguageStyles() {
    if (document.querySelector('#lifelink-language-style')) return;
    const style = document.createElement('style');
    style.id = 'lifelink-language-style';
    style.textContent = `
      .lifelink-language-float{position:fixed;right:14px;bottom:76px;z-index:1040;display:flex;align-items:center;gap:8px;background:#fff;border:1px solid #eceef3;border-radius:8px;padding:8px 10px;box-shadow:0 12px 30px rgba(23,26,42,.12)}
      .lifelink-language-float i{color:#e9194f}
      .lifelink-language-float select{width:auto;min-width:86px}
      .dark-mode .lifelink-language-float,.admin-module .lifelink-language-float,.donor-module .lifelink-language-float{background:#171c2b;border-color:rgba(255,255,255,.12)}
      @media (max-width:575.98px){.lifelink-language-float{right:10px;bottom:120px}}
    `;
    document.head.appendChild(style);
  }

  function ensurePublicContactBar() {
    removeTechStackLine();
    ensureLanguageStyles();
    if (document.querySelector('[data-lifelink-contact-bar]')) return;
    ensureFontAwesome();
    ensureContactStyles();
    const bar = document.createElement('div');
    bar.className = 'lifelink-contact-bar';
    bar.setAttribute('data-lifelink-contact-bar', 'true');
    const user = getUser();
    const authLinks = getToken() && user
      ? `<a href="${dashboardUrl(user.role)}" aria-label="Open dashboard"><i class="fa-solid fa-gauge-high"></i><span>Dashboard</span></a><a href="/pages/logout.html" aria-label="Logout"><i class="fa-solid fa-right-from-bracket"></i><span>Logout</span></a>`
      : '<a href="/pages/login.html" aria-label="Login"><i class="fa-solid fa-right-to-bracket"></i><span>Login</span></a><a href="/pages/register.html" aria-label="Register"><i class="fa-solid fa-user-plus"></i><span>Register</span></a><a href="/pages/forgot-password.html" aria-label="Forgot password"><i class="fa-solid fa-key"></i><span>Forgot password</span></a>';
    bar.innerHTML = `
      <div class="lifelink-contact-inner">
        ${authLinks}
        <a href="tel:+916280538868" aria-label="Call LifeLink"><i class="fa-solid fa-phone"></i><span>+91 6280538868</span></a>
        <a href="mailto:lifelink944@gmail.com" aria-label="Email LifeLink"><i class="fa-solid fa-envelope"></i><span>lifelink944@gmail.com</span></a>
        <a href="https://www.facebook.com/profile.php?id=61590421077812" target="_blank" rel="noopener" aria-label="LifeLink Facebook"><i class="fa-brands fa-facebook-f"></i><span>Facebook</span></a>
        <a href="https://www.instagram.com/lifelinkblood/" target="_blank" rel="noopener" aria-label="LifeLink Instagram"><i class="fa-brands fa-instagram"></i><span>Instagram</span></a>
      </div>
    `;
    document.body.appendChild(bar);
  }

  function ensureFontAwesome() {
    if (document.querySelector('link[href*="font-awesome"],link[href*="fontawesome"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.2/css/all.min.css';
    document.head.appendChild(link);
  }

  function ensureContactStyles() {
    if (document.querySelector('#lifelink-contact-style')) return;
    const style = document.createElement('style');
    style.id = 'lifelink-contact-style';
    style.textContent = `
      .lifelink-contact-bar{border-top:1px solid #eceef3;background:#fff;padding:14px 16px;color:#687083;font:500 14px Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif}
      .lifelink-contact-inner{max-width:1140px;margin:0 auto;display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap}
      .lifelink-contact-inner a{color:#374151;text-decoration:none;display:inline-flex;align-items:center;gap:8px;min-height:34px}
      .lifelink-contact-inner i{color:#e9194f;font-size:15px}
      .lifelink-contact-inner a:hover{color:#e9194f}
      .dark-mode .lifelink-contact-bar,.admin-module .lifelink-contact-bar,.donor-module .lifelink-contact-bar{background:#171c2b;border-color:rgba(255,255,255,.12)}
      .dark-mode .lifelink-contact-inner a,.admin-module .lifelink-contact-inner a,.donor-module .lifelink-contact-inner a{color:#d7dce8}
      @media (max-width:575.98px){.lifelink-contact-inner{align-items:flex-start;flex-direction:column}.lifelink-contact-inner a{width:100%;justify-content:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function removeTechStackLine() {
    const targets = [];
    const walker = document.createTreeWalker(document.body || document, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return /Built with HTML,\s*CSS,\s*JavaScript,\s*Bootstrap,\s*AJAX,\s*Node\.js and MySQL/i.test(node.nodeValue || '')
          ? NodeFilter.FILTER_ACCEPT
          : NodeFilter.FILTER_REJECT;
      }
    });
    while (walker.nextNode()) targets.push(walker.currentNode);
    targets.forEach((node) => {
      const parent = node.parentElement;
      const removable = parent?.closest('p,div,section,footer') || parent;
      removable?.remove();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    initLanguageControls();
    ensurePublicContactBar();
  });

  return { api, apiUrl, authHeaders, getToken, getUser, setSession, logout, dashboardUrl, toast, requireRole, money, renderRows, initIcons, getLanguage, setLanguage, initLanguageControls, applyLanguage, ensurePublicContactBar };
})();
