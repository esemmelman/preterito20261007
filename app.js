const el = id => document.getElementById(id);
const sheets = window.lessonSheets;
let current = 0, recorder, stream, preview, busy = false, playbackTimer, stoppedAt;
const originalRecording = new URL('opening-recording.webm', window.location.href).href;
let openingRecording = originalRecording, client, openingLoad = 0;
const silenceLimit = 10000, soundThreshold = 0.008;
let audioContext, inputSource, inputMonitor, outputMonitor, outputGeneration = 0;
const playbackLevels = new Map();
function stopInputMonitor() {
  clearInterval(inputMonitor);
  inputSource?.disconnect(); inputSource = null;
}
function stopOutputMonitor() {
  ++outputGeneration;
  clearInterval(outputMonitor);
}
function stopRecording(automatic = false) {
  if (recorder?.state !== 'recording') return;
  stopInputMonitor();
  stoppedAt = performance.now(); showPage(true); busy = true;
  recorder.stop(); controls();
  status(automatic ? 'Recording stopped after ten seconds of silence. Playback starts in one second.' : 'The page is back. Playback starts in one second.');
}
function monitorInput() {
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  inputSource = audioContext.createMediaStreamSource(stream);
  inputSource.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let lastSound = performance.now();
  inputMonitor = setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    if (rms >= soundThreshold) lastSound = performance.now();
    else if (performance.now() - lastSound >= silenceLimit) stopRecording(true);
  }, 100);
}
async function monitorPlayback(source) {
  stopOutputMonitor();
  const ticket = outputGeneration;
  let lastSound = performance.now(), previousTime = el('player').currentTime;
  let levels;
  // Decode without routing the player through AudioContext, preserving normal autoplay.
  if (!playbackLevels.has(source)) {
    const decoded = (async () => {
      const response = await fetch(source);
      if (!response.ok) throw new Error('Audio unavailable');
      const context = new OfflineAudioContext(1, 1, 44100);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      const step = Math.max(1, Math.round(buffer.sampleRate / 10));
      const result = new Float32Array(Math.ceil(buffer.length / step));
      for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
        const data = buffer.getChannelData(channel);
        for (let i = 0; i < data.length; i++) result[Math.floor(i / step)] += data[i] * data[i] / step;
      }
      return { values: result, rate: buffer.sampleRate / step };
    })();
    playbackLevels.set(source, decoded);
  }
  playbackLevels.get(source).then(result => { levels = result; }).catch(() => {});
  outputMonitor = setInterval(() => {
    if (ticket !== outputGeneration || el('player').paused || el('player').ended) { clearInterval(outputMonitor); return; }
    const player = el('player'), now = performance.now();
    const advancing = player.currentTime > previousTime;
    const energy = levels?.values[Math.floor(player.currentTime * levels.rate)] || 0;
    if (advancing && !player.muted && player.volume > 0 && (!levels || energy >= soundThreshold * soundThreshold)) lastSound = now;
    previousTime = player.currentTime;
    if (now - lastSound >= silenceLimit) {
      player.pause(); player.currentTime = 0;
      el('replay').hidden = false;
      status('Playback stopped after ten seconds of silence.', true);
      stopOutputMonitor();
    }
  }, 100);
}
const status = (message, visible = false) => {
  el('status').textContent = message;
  el('status').classList.toggle('quiet', !visible);
};
function alignRecorder() {
  const heading = sheets[current].querySelector('h1').getBoundingClientRect();
  const frame = document.querySelector('.center-frame');
  const buttonHeight = el('record').getBoundingClientRect().height;
  frame.style.setProperty('--recording-top', `${heading.top + (heading.height - buttonHeight) / 2 - frame.getBoundingClientRect().top}px`);
}
new ResizeObserver(alignRecorder).observe(el('pages'));
window.addEventListener('resize', alignRecorder);
function controls() {
  const active = recorder?.state === 'recording';
  el('record').disabled = busy;
  el('record').textContent = active ? 'Stop' : 'Record';
  el('record').setAttribute('aria-pressed', String(Boolean(active)));
  document.querySelectorAll('#page-nav button').forEach(b => { b.disabled = busy || active; });
}
function showPage(visible) {
  el('pages').classList.toggle('recording-blank', !visible);
  el('pages').setAttribute('aria-hidden', String(!visible));
}
function clearPlayer() {
  stopOutputMonitor();
  clearTimeout(playbackTimer);
  el('player').pause(); el('player').removeAttribute('src'); el('player').load();
  el('replay').hidden = true;
  if (preview) { playbackLevels.delete(preview); URL.revokeObjectURL(preview); }
  preview = null;
}
async function playRecording(source = preview) {
  if (!source) return;
  stopOutputMonitor();
  if (el('player').src !== source) el('player').src = source;
  el('player').currentTime = 0;
  try {
    await el('player').play();
    monitorPlayback(source);
    el('replay').hidden = true;
    status('Playing recording.');
  } catch {
    el('replay').hidden = false;
    status('Tap Play to hear your recording.', true);
  }
}
window.selectPage = index => {
  if (busy || recorder?.state === 'recording') return;
  current = index;
  sheets.forEach((s, i) => { s.hidden = i !== index; });
  [...el('page-nav').children].forEach((b, i) => {
    if (i === index) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  alignRecorder();
  playRecording(openingRecording || preview);
};
el('record').onclick = async () => {
  if (recorder?.state === 'recording') {
    stopRecording();
    return;
  }
  busy = true; clearPlayer(); showPage(false); controls();
  try {
    audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
    audioContext.resume().catch(() => {});
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      throw new Error('Recording requires HTTPS or localhost and a browser with microphone recording support.');
    }
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      stopInputMonitor();
      stream.getTracks().forEach(track => track.stop());
      const take = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || 'audio/webm' });
      if (!take.size) {
        busy = false; showPage(true); status('No audio captured. Try again.', true); controls(); return;
      }
      preview = URL.createObjectURL(take);
      el('player').src = preview;
      playbackTimer = setTimeout(() => {
        busy = false; controls(); playRecording();
      }, Math.max(0, 1000 - (performance.now() - stoppedAt)));
    };
    recorder.onerror = () => {
      stopInputMonitor();
      recorder.onstop = () => {};
      stream.getTracks().forEach(track => track.stop());
      recorder = null; busy = false; showPage(true);
      status('Recording failed. Try again.', true); controls();
    };
    recorder.start(); monitorInput(); status('Recording… Speak now, then select Stop.');
  } catch (error) {
    stopInputMonitor();
    stream?.getTracks().forEach(track => track.stop());
    showPage(true); status(error.message, true);
  } finally { busy = false; controls(); }
};
el('replay').onclick = () => playRecording(el('player').src);
el('player').addEventListener('error', () => status('This audio could not play. Try recording a new take.', true));
el('player').addEventListener('pause', stopOutputMonitor);
el('player').addEventListener('ended', stopOutputMonitor);
window.addEventListener('pagehide', () => {
  clearTimeout(playbackTimer);
  stopInputMonitor(); stopOutputMonitor();
  stream?.getTracks().forEach(track => track.stop());
});
window.selectPage(0);
controls();

// Keep the saved opening/example recording separate from temporary practice takes.
async function loadOpeningRecording(session) {
  const ticket = ++openingLoad;
  openingRecording = originalRecording;
  if (!session) return;
  try {
    let { data, error } = await client.from('spanish_recordings')
      .select('object_path').eq('user_id', session.user.id)
      .eq('lesson_id', 'preterite-v1').eq('page_key', 'opening-example').maybeSingle();
    if (error) throw error;
    if (ticket !== openingLoad) return;
    if (!data) {
      // Preserve the recovered first take separately; practice never overwrites it.
      const response = await fetch(originalRecording);
      if (!response.ok) throw new Error('The original recording could not be loaded.');
      const path = `${session.user.id}/preterite-v1/opening-example/${crypto.randomUUID()}.webm`;
      const upload = await client.storage.from('spanish-page-recordings').upload(path, await response.blob(), { contentType: 'audio/webm', upsert: false });
      if (upload.error) throw upload.error;
      const saved = await client.from('spanish_recordings').upsert({
        user_id: session.user.id, lesson_id: 'preterite-v1', page_key: 'opening-example', object_path: path
      }, { onConflict: 'user_id,lesson_id,page_key' });
      if (saved.error) throw saved.error;
      data = { object_path: path };
    }
    const signed = await client.storage.from('spanish-page-recordings').createSignedUrl(data.object_path, 3600);
    if (signed.error) throw signed.error;
    if (ticket !== openingLoad) return;
    openingRecording = signed.data.signedUrl;
    // The bundled original already started on arrival; use the cloud copy on future selections.
  } catch (error) {
    openingRecording = originalRecording;
  }
}
if (window.supabase && window.SPANISH_CONFIG?.url) {
  client = window.supabase.createClient(window.SPANISH_CONFIG.url, window.SPANISH_CONFIG.publishableKey);
  client.auth.onAuthStateChange((event, session) => {
    if (['INITIAL_SESSION', 'SIGNED_IN', 'SIGNED_OUT'].includes(event)) {
      setTimeout(() => loadOpeningRecording(session), 0);
    }
  });
}
