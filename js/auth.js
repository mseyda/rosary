const Auth = (() => {
  const HASH_KEY    = 'rosary_admin_hash';
  const SESSION_KEY = 'rosary_admin';

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  }

  return {
    isSetup() {
      return !!localStorage.getItem(HASH_KEY);
    },

    async setup(pw) {
      if (!pw || pw.length < 6) return { ok: false, msg: 'Şifre en az 6 karakter olmalı.' };
      localStorage.setItem(HASH_KEY, await sha256(pw));
      sessionStorage.setItem(SESSION_KEY, '1');
      return { ok: true };
    },

    async login(pw) {
      const stored = localStorage.getItem(HASH_KEY);
      if (!stored) return { ok: false, msg: 'Önce şifre belirleyin.' };
      if (await sha256(pw) === stored) {
        sessionStorage.setItem(SESSION_KEY, '1');
        return { ok: true };
      }
      return { ok: false, msg: 'Şifre yanlış.' };
    },

    isAdmin() {
      return sessionStorage.getItem(SESSION_KEY) === '1';
    },

    logout() {
      sessionStorage.removeItem(SESSION_KEY);
    },

    async changePassword(oldPw, newPw) {
      const stored = localStorage.getItem(HASH_KEY);
      if (!stored) return { ok: false, msg: 'Şifre ayarlanmamış.' };
      if (await sha256(oldPw) !== stored) return { ok: false, msg: 'Mevcut şifre yanlış.' };
      if (!newPw || newPw.length < 6) return { ok: false, msg: 'Yeni şifre en az 6 karakter olmalı.' };
      localStorage.setItem(HASH_KEY, await sha256(newPw));
      return { ok: true };
    },
  };
})();
