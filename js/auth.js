const Auth = (() => {
  const SESSION_KEY = 'rosary_admin';
  const PW_KEY      = 'rosary_admin_pw';

  function ssGet(k)    { try { return sessionStorage.getItem(k); } catch(e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); }     catch(e) {} }
  function ssRm(k)     { try { sessionStorage.removeItem(k); }     catch(e) {} }

  return {
    isAdmin()      { return ssGet(SESSION_KEY) === '1'; },
    getPlaintext() { return ssGet(PW_KEY) || ''; },

    logout() {
      ssRm(SESSION_KEY);
      ssRm(PW_KEY);
    },

    async login(pw) {
      if (!pw) return { ok: false, msg: 'Şifre girin.' };
      try {
        const res = await fetch('/.netlify/functions/rosary-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'verify', adminPassword: pw }),
        });
        if (res.ok) {
          ssSet(SESSION_KEY, '1');
          ssSet(PW_KEY, pw);
          return { ok: true };
        }
        return { ok: false, msg: 'Şifre yanlış.' };
      } catch (e) {
        return { ok: false, msg: 'Bağlantı hatası. İnternet bağlantınızı kontrol edin.' };
      }
    },
  };
})();
