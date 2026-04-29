// Simple demo-level auth — stores a session pointer in localStorage
(function (global) {
  const SESSION_KEY = 'phoenix_accounting_session_v1';
  const Auth = {};

  Auth.currentUser = function () {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    try {
      const { userId } = JSON.parse(raw);
      return Store.findUser(userId);
    } catch (e) {
      return null;
    }
  };

  Auth.login = async function (email, password) {
    const user = Store.findUserByEmail(email);
    if (!user) throw new Error('No account found with that email.');
    const hash = await Utils.hash(password + ':' + user.salt);
    if (hash !== user.passwordHash) throw new Error('Incorrect password.');
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, at: Date.now() }));
    return user;
  };

  Auth.register = async function (data) {
    if (Store.findUserByEmail(data.email)) {
      throw new Error('An account with that email already exists.');
    }
    const salt = Utils.uid();
    const passwordHash = await Utils.hash(data.password + ':' + salt);
    const user = {
      id: Utils.uid(),
      role: 'sme',
      email: data.email.trim(),
      ownerName: data.ownerName.trim(),
      businessName: data.businessName.trim(),
      phone: data.phone ? data.phone.trim() : '',
      province: data.province || '',
      createdAt: new Date().toISOString(),
      salt,
      passwordHash
    };
    Store.addUser(user);
    localStorage.setItem(SESSION_KEY, JSON.stringify({ userId: user.id, at: Date.now() }));
    return user;
  };

  Auth.logout = function () {
    localStorage.removeItem(SESSION_KEY);
  };

  global.Auth = Auth;
})(window);
