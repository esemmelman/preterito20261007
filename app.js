const el = id => document.getElementById(id);
const sheets = window.lessonSheets;
let current = 0, recorder, stream, preview, busy = false, playbackTimer, stoppedAt;
const status = (message, visible = false) => {
  el('status').textContent = message;
  el('status').classList.toggle('quiet', !visible);
};
function alignRecorder() {
  const heading = sheets[current].querySelector('h1');
  const frame = document.querySelector('.center-frame');
  frame.style.setProperty('--recording-top', `${heading.getBoundingClientRect().top - frame.getBoundingClientRect().top}px`);
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
  el('pages').style.visibility = visible ? 'visible' : 'hidden';
  el('pages').setAttribute('aria-hidden', String(!visible));
}
function clearPlayer() {
  clearTimeout(playbackTimer);
  el('player').pause(); el('player').removeAttribute('src'); el('player').load();
  el('replay').hidden = true;
  if (preview) URL.revokeObjectURL(preview);
  preview = null;
}
async function playRecording() {
  if (!preview) return;
  el('player').currentTime = 0;
  try {
    await el('player').play();
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
  playRecording();
};
el('record').onclick = async () => {
  if (recorder?.state === 'recording') {
    stoppedAt = performance.now();
    showPage(true);
    busy = true;
    recorder.stop();
    controls();
    status('The page is back. Playback starts in two seconds.');
    return;
  }
  busy = true; clearPlayer(); showPage(false); controls();
  try {
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      throw new Error('Recording requires HTTPS or localhost and a browser with microphone recording support.');
    }
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(t => MediaRecorder.isTypeSupported(t));
    recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    const chunks = [];
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data); };
    recorder.onstop = () => {
      stream.getTracks().forEach(track => track.stop());
      const take = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || 'audio/webm' });
      if (!take.size) {
        busy = false; showPage(true); status('No audio captured. Try again.', true); controls(); return;
      }
      preview = URL.createObjectURL(take);
      el('player').src = preview;
      playbackTimer = setTimeout(() => {
        busy = false; controls(); playRecording();
      }, Math.max(0, 2000 - (performance.now() - stoppedAt)));
    };
    recorder.onerror = () => {
      recorder.onstop = () => {};
      stream.getTracks().forEach(track => track.stop());
      recorder = null; busy = false; showPage(true);
      status('Recording failed. Try again.', true); controls();
    };
    recorder.start(); status('Recording… Speak now, then select Stop.');
  } catch (error) {
    stream?.getTracks().forEach(track => track.stop());
    showPage(true); status(error.message, true);
  } finally { busy = false; controls(); }
};
el('replay').onclick = playRecording;
el('player').addEventListener('error', () => status('This audio could not play. Try recording a new take.', true));
window.addEventListener('pagehide', () => {
  clearTimeout(playbackTimer);
  stream?.getTracks().forEach(track => track.stop());
});
window.selectPage(0);
controls();
