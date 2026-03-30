/**
 * BloomBuddy — cloud sync (Supabase)
 * Set window.SUPABASE_URL + window.SUPABASE_ANON_KEY in supabase-config.js (see supabase-schema.sql).
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export function initBloomSync() {
  const url = window.SUPABASE_URL;
  const key = window.SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.info('[BloomBuddy] Cloud sync off — add Supabase URL + anon key in supabase-config.js');
    return;
  }

  const supabase = createClient(url, key);

  const bar = document.createElement('div');
  bar.className = 'sync-bar';
  bar.id = 'sync-bar';
  bar.innerHTML = `
    <p class="sync-bar-label" id="sync-bar-label">Sign in to sync moods on every device</p>
    <div class="sync-bar-row">
      <button type="button" class="sync-btn" id="sync-btn-google">Google</button>
      <input type="email" class="sync-email" id="sync-email" placeholder="Email" autocomplete="email" />
      <button type="button" class="sync-btn" id="sync-btn-magic">Email link</button>
      <button type="button" class="sync-btn sync-btn--ghost" id="sync-btn-out" hidden>Sign out</button>
    </div>`;
  const app = document.getElementById('app');
  if (app) app.appendChild(bar);

  const labelEl = document.getElementById('sync-bar-label');
  const emailEl = document.getElementById('sync-email');
  const btnGoogle = document.getElementById('sync-btn-google');
  const btnMagic = document.getElementById('sync-btn-magic');
  const btnOut = document.getElementById('sync-btn-out');

  function getMoodData() {
    return window.BloomBuddy.getMoodData();
  }

  async function mergeRemoteAndLocalThenPush(user) {
    const { data: rows, error } = await supabase.from('moods').select('date_str, mood');
    if (error) {
      console.warn('[BloomBuddy] pull', error);
      return;
    }
    const local = getMoodData();
    const remote = {};
    for (const row of rows || []) remote[row.date_str] = row.mood;
    const merged = { ...remote, ...local };
    try {
      localStorage.setItem('moodData', JSON.stringify(merged));
    } catch (e) {
      console.warn('[BloomBuddy] localStorage merge', e);
    }
    const payload = Object.entries(merged).map(([date_str, mood]) => ({
      user_id: user.id,
      date_str,
      mood,
    }));
    if (payload.length) {
      const { error: upErr } = await supabase
        .from('moods')
        .upsert(payload, { onConflict: 'user_id,date_str' });
      if (upErr) console.warn('[BloomBuddy] push', upErr);
    }
    window.BloomBuddy.refreshMoodViewsAfterSync();
  }

  async function pushOne(uid, dateStr, mood) {
    const { error } = await supabase.from('moods').upsert(
      { user_id: uid, date_str: dateStr, mood },
      { onConflict: 'user_id,date_str' },
    );
    if (error) console.warn('[BloomBuddy] upsert mood', error);
  }

  async function updateUI(session) {
    if (!labelEl) return;
    if (session?.user) {
      const em = session.user.email || session.user.phone || 'Signed in';
      labelEl.textContent = `Synced · ${em}`;
      btnOut.hidden = false;
      btnGoogle.hidden = true;
      btnMagic.hidden = true;
      if (emailEl) emailEl.hidden = true;
    } else {
      labelEl.textContent = 'Sign in to sync moods on every device';
      btnOut.hidden = true;
      btnGoogle.hidden = false;
      btnMagic.hidden = false;
      if (emailEl) emailEl.hidden = false;
    }
  }

  supabase.auth.onAuthStateChange(async (event, session) => {
    await updateUI(session);
    if (event === 'SIGNED_IN' && session?.user) {
      await mergeRemoteAndLocalThenPush(session.user);
    }
  });

  supabase.auth.getSession().then(async ({ data: { session } }) => {
    await updateUI(session);
    if (session?.user) await mergeRemoteAndLocalThenPush(session.user);
  });

  window.BloomBuddy.onMoodSaved = async (dateStr, mood) => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) return;
    await pushOne(session.user.id, dateStr, mood);
  };

  btnGoogle?.addEventListener('click', async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin + window.location.pathname },
    });
    if (error) console.warn('[BloomBuddy] Google sign-in', error);
  });

  btnMagic?.addEventListener('click', async () => {
    const email = (emailEl?.value || '').trim();
    if (!email) {
      alert('Enter your email address.');
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin + window.location.pathname },
    });
    if (error) {
      console.warn('[BloomBuddy] magic link', error);
      alert(error.message);
      return;
    }
    alert('Check your email for the sign-in link.');
  });

  btnOut?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.BloomBuddy.refreshMoodViewsAfterSync();
  });
}
