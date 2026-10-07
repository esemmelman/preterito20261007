/* global supabase */
const el = id => document.getElementById(id);
const sheets = window.lessonSheets;
let current = 0, client, user, recorder, stream, take, preview, busy = false, generation = 0;
let recording = null;
const recordingKey = 'all-pages';
const bucket = 'spanish-page-recordings';
const status = message => { el('status').textContent = message; };
function controls() {
  const active = Boolean(recorder && recorder.state !== 'inactive');
  el('record').disabled = !user || busy || active || Boolean(take);
  el('stop').disabled = !active || busy;
  el('save').disabled = !take || busy || !user;
  el('discard').disabled = !take || busy;
  document.querySelectorAll('#page-nav button').forEach(b => { b.disabled = busy || active || Boolean(take); });
  el('signout').disabled = busy || active || Boolean(take);
}
function clearPlayer() {
  el('player').pause(); el('player').removeAttribute('src'); el('player').load(); el('player').hidden = true;
  if (preview) URL.revokeObjectURL(preview);
  preview = null;
}
async function loadAudio(auto = false) {
  const ticket = ++generation;
  clearPlayer();
  if (!user) return;
  const row = recording;
  if (!row) { status('No recording yet. Select Record to make one recording for all pages.'); return; }
  status('Loading recording…');
  try {
    const { data, error } = await client.storage.from(bucket).createSignedUrl(row.object_path, 3600);
    if (error) throw error;
    if (ticket !== generation) return;
    el('player').src = data.signedUrl; el('player').hidden = false;
    status('Recording ready.');
    if (auto) {
      try { await el('player').play(); }
      catch { if (ticket === generation) status('Tap Play to hear your recording.'); }
    }
  } catch (error) { if (ticket === generation) status(`Could not load recording: ${error.message}`); }
}
window.selectPage = index => {
  if (busy || take || (recorder && recorder.state !== 'inactive')) return;
  current = index;
  sheets.forEach((s, i) => { s.hidden = i !== index; });
  [...el('page-nav').children].forEach((b, i) => {
    if (i === index) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  el('recording-label').textContent = 'One recording for all pages';
  loadAudio(true);
};
async function refreshSession(session) {
  ++generation; clearPlayer(); recording = null; user = session?.user || null;
  el('login-form').hidden = Boolean(user); el('signed-in').hidden = !user; el('signout').hidden = !user;
  el('signed-in').textContent = user ? `Signed in as ${user.email}` : '';
  controls();
  if (!user) { status('Sign in to record and load your saved recordings.'); return; }
  const id = user.id;
  const { data, error } = await client.from('spanish_recordings').select('page_key,object_path').eq('user_id', id).eq('lesson_id', 'preterite-v1').eq('page_key', recordingKey);
  if (user?.id !== id) return;
  if (error) { status(`Could not load saved recordings: ${error.message}`); return; }
  recording = data[0] || null;
  await loadAudio(true);
}
async function authenticate(signup) {
  if (!client) return;
  if (!el('login-form').reportValidity()) return;
  busy = true; controls();
  try {
    const credentials = { email: el('email').value.trim(), password: el('password').value };
    const { data, error } = signup ? await client.auth.signUp(credentials) : await client.auth.signInWithPassword(credentials);
    if (error) throw error;
    el('password').value = '';
    if (signup && !data.session) status('Check your email to confirm your account, then sign in.');
  } catch (error) { status(error.message); }
  finally { busy = false; controls(); }
}
el('login-form').addEventListener('submit', e => { e.preventDefault(); authenticate(false); });
el('signup').onclick = () => authenticate(true);
el('signout').onclick = async () => {
  const { error } = await client.auth.signOut(); if (error) status(error.message);
};
el('record').onclick = async () => {
  busy = true; controls(); ++generation; clearPlayer();
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw new Error('Recording requires HTTPS or localhost and a browser with microphone recording support.');
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      take = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || 'audio/webm' });
      if (!take.size) { take = null; status('No audio captured. Try again.'); controls(); return; }
      preview = URL.createObjectURL(take); el('player').src = preview; el('player').hidden = false;
      status('Listen to your take, then Save recording or Discard take.'); controls();
    };
    recorder.onerror = () => {
      stream.getTracks().forEach(track => track.stop()); status('Recording failed. Try again.');
      recorder.onstop = () => {}; recorder = null; controls();
    };
    recorder.start(); status('Recording… Speak now, then select Stop.');
  } catch (error) { stream?.getTracks().forEach(track => track.stop()); status(error.message); }
  finally { busy = false; controls(); }
};
el('stop').onclick = () => { recorder.stop(); controls(); };
el('discard').onclick = () => { take = null; clearPlayer(); controls(); loadAudio(); };
el('save').onclick = async () => {
  if (!take || !user) return;
  busy = true; controls(); status('Saving recording to Supabase…');
  const pageKey = recordingKey;
  const old = recording;
  const extension = take.type.includes('mp4') ? 'm4a' : take.type.includes('ogg') ? 'ogg' : 'webm';
  const path = `${user.id}/preterite-v1/${pageKey}/${crypto.randomUUID()}.${extension}`;
  let uploaded = false;
  try {
    const upload = await client.storage.from(bucket).upload(path, take, { contentType: take.type, upsert: false });
    if (upload.error) throw upload.error;
    uploaded = true;
    const row = { user_id: user.id, lesson_id: 'preterite-v1', page_key: pageKey, object_path: path };
    const saved = await client.from('spanish_recordings').upsert(row, { onConflict: 'user_id,lesson_id,page_key' });
    if (saved.error) throw saved.error;
    recording = row; take = null;
    if (old) await client.storage.from(bucket).remove([old.object_path]);
    await loadAudio(); status('Saved. This recording plays for every page and is available on your other devices.');
  } catch (error) {
    if (uploaded) await client.storage.from(bucket).remove([path]);
    status(`Save failed; your take is still available to retry. ${error.message}`);
  } finally { busy = false; controls(); }
};
el('player').addEventListener('error', () => status('This audio could not play. Try a current browser or record a new take on this device.'));
window.addEventListener('beforeunload', event => {
  stream?.getTracks().forEach(track => track.stop());
  if (take || busy || recorder?.state === 'recording') { event.preventDefault(); event.returnValue = ''; }
});
window.selectPage(0);
const config = window.SPANISH_CONFIG;
if (config?.url && config?.publishableKey && window.supabase) {
  client = supabase.createClient(config.url, config.publishableKey);
  client.auth.onAuthStateChange((event, session) => {
    if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT'].includes(event)) setTimeout(() => refreshSession(session), 0);
  });
} else {
  status('Supabase setup is pending. Page navigation and printing are ready.');
}
