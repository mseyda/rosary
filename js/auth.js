const Auth = (() => {
  const HASH_KEY    = 'rosary_admin_hash';
  const SESSION_KEY = 'rosary_admin';

  // Synchronous hash (no async/await, no Web Crypto API)
  function hash(str) {
    const salt = 'rsr_seyda_2024';
    const s = str + salt;
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761);
      h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
    h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
    h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(16).padStart(16, '0');
  }

  function lsGet(k)      { try { return localStorage.getItem(k); }   catch(e) { return null; } }
  function lsSet(k, v)   { try { localStorage.setItem(k, v); return true; } catch(e) { return false; } }
  function ssGet(k)      { try { return sessionStorage.getItem(k); } catch(e) { return null; } }
  function ssSet(k, v)   { try { sessionStorage.setItem(k, v); }     catch(e) {} }
  function ssRemove(k)   { try { sessionStorage.removeItem(k); }     catch(e) {} }

  return {
    isSetup()  { return !!lsGet(HASH_KEY); },
    isAdmin()  { return ssGet(SESSION_KEY) === '1'; },
    logout()   { ssRemove(SESSION_KEY); },

    setup(pw) {
      if (!pw || pw.length < 6)
        return { ok: false, msg: 'Şifre en az 6 karakter olmalı.' };
      if (!lsSet(HASH_KEY, hash(pw)))
        return { ok: false, msg: 'Tarayıcı depolama alanı kullanılamıyor. Gizli sekmeyi kapatıp tekrar deneyin.' };
      ssSet(SESSION_KEY, '1');
      return { ok: true };
    },

    login(pw) {
      const stored = lsGet(HASH_KEY);
      if (!stored) return { ok: false, msg: 'Önce şifre belirleyin.' };
      if (hash(pw) !== stored) return { ok: false, msg: 'Şifre yanlış.' };
      ssSet(SESSION_KEY, '1');
      return { ok: true };
    },

    changePassword(oldPw, newPw) {
      const stored = lsGet(HASH_KEY);
      if (!stored)                   return { ok: false, msg: 'Şifre ayarlanmamış.' };
      if (hash(oldPw) !== stored)    return { ok: false, msg: 'Mevcut şifre yanlış.' };
      if (!newPw || newPw.length < 6) return { ok: false, msg: 'Yeni şifre en az 6 karakter olmalı.' };
      lsSet(HASH_KEY, hash(newPw));
      return { ok: true };
    },
  };
})();
