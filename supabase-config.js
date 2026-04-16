(function () {
  var fallbackConfig = {
    supabaseUrl: "https://nhifsoxmiqosuaiiprhd.supabase.co",
    supabaseAnonKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oaWZzb3htaXFvc3VhaWlwcmhkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU4OTkwNDEsImV4cCI6MjA5MTQ3NTA0MX0.fpvxGs0U-qzeM26FWJDdQYAAKIq2PGnHQIZ1Vrq3voE"
  };
  var runtimeConfig = window.__GUTGUARD_ENV || {};
  var SUPABASE_URL = runtimeConfig.supabaseUrl || fallbackConfig.supabaseUrl;
  var SUPABASE_ANON_KEY = runtimeConfig.supabaseAnonKey || fallbackConfig.supabaseAnonKey;
  var STORAGE_KEY = "gutguard.supabase.auth";
  var memoryStorage = {};

  function looksConfigured(value) {
    return !!value && value.indexOf("YOUR_") === -1 && value.indexOf("<") === -1;
  }

  function isConfigured() {
    return (
      typeof window.supabase !== "undefined" &&
      looksConfigured(SUPABASE_URL) &&
      looksConfigured(SUPABASE_ANON_KEY)
    );
  }

  function createSafeStorage() {
    return {
      getItem: function (key) {
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            return window.localStorage.getItem(key);
          }
        } catch (error) {}
        return Object.prototype.hasOwnProperty.call(memoryStorage, key)
          ? memoryStorage[key]
          : null;
      },
      setItem: function (key, value) {
        memoryStorage[key] = value;
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.setItem(key, value);
          }
        } catch (error) {}
      },
      removeItem: function (key) {
        delete memoryStorage[key];
        try {
          if (typeof window !== "undefined" && window.localStorage) {
            window.localStorage.removeItem(key);
          }
        } catch (error) {}
      }
    };
  }

  function getClient() {
    if (!isConfigured()) {
      return null;
    }

    if (!window.__gutguardSupabaseClient) {
      window.__gutguardSupabaseClient = window.supabase.createClient(
        SUPABASE_URL,
        SUPABASE_ANON_KEY,
        {
          auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: false,
            storageKey: STORAGE_KEY,
            storage: createSafeStorage()
          }
        }
      );
    }

    return window.__gutguardSupabaseClient;
  }

  async function getSession() {
    var client = getClient();
    if (!client) {
      return null;
    }
    var result = await client.auth.getSession();
    if (result.error) {
      throw result.error;
    }
    return result.data.session || null;
  }

  async function getUser() {
    var session = await getSession();
    return session ? session.user : null;
  }

  async function signInWithPassword(email, password) {
    var client = getClient();
    if (!client) {
      throw new Error("Supabase is not configured.");
    }
    var result = await client.auth.signInWithPassword({
      email: email,
      password: password
    });
    if (result.error) {
      throw result.error;
    }
    return result.data;
  }

  async function signUpWithPassword(email, password, metadata) {
    var client = getClient();
    if (!client) {
      throw new Error("Supabase is not configured.");
    }
    var result = await client.auth.signUp({
      email: email,
      password: password,
      options: {
        data: metadata || {}
      }
    });
    if (result.error) {
      throw result.error;
    }
    return result.data;
  }

  async function signOut() {
    var client = getClient();
    if (!client) {
      return;
    }
    var result = await client.auth.signOut();
    if (result.error) {
      throw result.error;
    }
  }

  function onAuthStateChange(callback) {
    var client = getClient();
    if (!client) {
      return { data: { subscription: { unsubscribe: function () {} } } };
    }
    return client.auth.onAuthStateChange(callback);
  }

  window.GutguardSupabase = {
    getClient: getClient,
    isConfigured: isConfigured,
    getSession: getSession,
    getUser: getUser,
    signInWithPassword: signInWithPassword,
    signUpWithPassword: signUpWithPassword,
    signOut: signOut,
    onAuthStateChange: onAuthStateChange
  };
})();
