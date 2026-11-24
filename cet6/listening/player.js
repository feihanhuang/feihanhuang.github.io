"use strict";

const audio = document.getElementById("recording");
const container = document.getElementById("passages");
const notice = document.getElementById("notice");
const embeddedData = document.getElementById("listening-data");
const clipDirectory = container.dataset.clips;
const rates = [1, 2, 0.5];
const speedLabels = ["1×", "2×", "½×"];
const captions = ["隐藏", "英文", "中文", "中英双语"];
const captionGlyphs = ["", "英", "译", "双"];
const icons = {
  play: '<path d="M8 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M9 5v14m6-14v14" stroke-width="3"/>',
  loop: '<path d="m16 2 3 3-3 3m3-3H7a4 4 0 0 0-4 4v2m5 11-3-3 3-3m-3 3h12a4 4 0 0 0 4-4v-2"/>',
  captions: '<rect x="2" y="5" width="20" height="14" rx="3"/><path d="M6 10h4m4 0h4M6 14h7m4 0h1"/>',
};

let current = null;
let pendingSeek = null;
let endTimer = 0;
let playbackAttempt = 0;

function announce(message) {
  notice.textContent = message;
  notice.hidden = false;
}

function icon(name) {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-width", "1.7");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.innerHTML = icons[name];
  return svg;
}

function label(button, row, name, title = name) {
  button.title = title;
  button.setAttribute("aria-label", row.description + "，" + name);
}

function updatePlayback(row) {
  if (!row) return;
  const selected = current === row;
  const playing = selected && !audio.paused;
  row.item.toggleAttribute("data-current", selected);
  row.playButton.toggleAttribute("data-active", playing);
  row.playButton.replaceChildren(icon(playing ? "pause" : "play"));
  label(row.playButton, row, playing ? "暂停" : "播放");
}

function updateSpeed(row) {
  const speed = speedLabels[row.speed];
  const next = speedLabels[(row.speed + 1) % rates.length];
  row.speedButton.textContent = speed;
  row.speedButton.toggleAttribute("data-active", row.speed !== 0);
  label(row.speedButton, row, "倍速 " + speed + "，切换至 " + next, "倍速 " + speed + " → " + next);
}

function updateCaptions(row) {
  const state = row.captionState;
  row.english.hidden = state !== 1 && state !== 3;
  row.chinese.hidden = state !== 2 && state !== 3;
  row.captionButton.replaceChildren(state === 0 ? icon("captions") : captionGlyphs[state]);
  row.captionButton.toggleAttribute("data-active", state !== 0);
  row.captionButton.setAttribute("aria-expanded", String(state !== 0));
  const next = captions[(state + 1) % captions.length];
  label(row.captionButton, row, "字幕 " + captions[state] + "，切换至" + next, "字幕 " + captions[state] + " → " + next);
}

function stopEndTimer() {
  clearTimeout(endTimer);
  endTimer = 0;
}

function checkEnd() {
  stopEndTimer();
  if (!current || pendingSeek || audio.paused || audio.seeking) return;
  const seconds = (current.end - audio.currentTime) / audio.playbackRate;
  if (seconds <= 0.005) {
    if (current.loop) {
      audio.currentTime = current.start;
    } else {
      audio.pause();
      updatePlayback(current);
    }
    return;
  }
  endTimer = setTimeout(checkEnd, Math.max(8, Math.min(180, seconds * 1000)));
}

function play(row) {
  const previous = current;
  const changed = previous !== row;
  const sourceChanged = audio.getAttribute("src") !== row.source;
  const resume = !changed && !sourceChanged && !audio.ended && audio.currentTime >= row.start - 0.04
    && audio.currentTime < row.end - 0.025;
  const attempt = ++playbackAttempt;
  if (changed) {
    stopEndTimer();
    audio.pause();
    current = row;
  }
  notice.hidden = true;
  if (sourceChanged) audio.src = row.source;
  if (!resume) {
    pendingSeek = sourceChanged || audio.readyState < HTMLMediaElement.HAVE_METADATA ? row : null;
    if (!pendingSeek) {
      audio.currentTime = row.start;
    } else {
      // Also provide the target immediately on browsers that support seeking
      // before metadata is ready. The metadata event covers other browsers.
      try { audio.currentTime = row.start; } catch { /* Applied when ready. */ }
    }
  }
  audio.playbackRate = rates[row.speed];

  // On touch browsers, the call to play must remain in the same user gesture.
  audio.play().catch(() => {
    if (attempt !== playbackAttempt) return;
    pendingSeek = null;
    updatePlayback(row);
    announce("无法播放音频，请确认音频可访问后再试。");
  });

  if (changed) updatePlayback(previous);
  updatePlayback(row);
  checkEnd();
}

function togglePlayback(row) {
  if (current === row && !audio.paused) {
    ++playbackAttempt;
    pendingSeek = null;
    audio.pause();
    stopEndTimer();
    updatePlayback(row);
  } else {
    play(row);
  }
}

function toggleLoop(row) {
  row.loop = !row.loop;
  row.loopButton.setAttribute("aria-pressed", String(row.loop));
  label(row.loopButton, row, "循环播放", row.loop ? "关闭循环" : "循环播放");
  if (row.loop) play(row);
}

function caption(language, text, id) {
  const paragraph = document.createElement("p");
  paragraph.className = "caption";
  paragraph.lang = language;
  paragraph.id = id;
  paragraph.textContent = text;
  return paragraph;
}

function button(action, handler) {
  const control = document.createElement("button");
  control.type = "button";
  control.dataset.action = action;
  control.addEventListener("click", handler);
  return control;
}

function sentence([start, end, english, chinese, clipRange], title, groupNumber, lineNumber) {
  const item = document.createElement("li");
  item.className = "sentence";
  const controls = document.createElement("div");
  controls.className = "controls";
  const number = document.createElement("span");
  number.className = "sequence";
  number.textContent = String(lineNumber);
  number.setAttribute("aria-hidden", "true");

  const numberInFile = String(groupNumber).padStart(2, "0") + "-" + String(lineNumber).padStart(3, "0");
  const row = {
    start: clipRange ? clipRange[0] : start,
    end: clipRange ? clipRange[1] : end,
    source: clipDirectory ? clipDirectory + numberInFile + ".mp3" : audio.dataset.src,
    item,
    loop: false, speed: 0, captionState: 0,
    description: title + "，第 " + lineNumber + " 句",
    english: caption("en", english, "en-" + groupNumber + "-" + lineNumber),
    chinese: caption("zh-CN", chinese, "zh-" + groupNumber + "-" + lineNumber),
  };
  row.playButton = button("play", () => togglePlayback(row));
  row.loopButton = button("loop", () => toggleLoop(row));
  row.loopButton.append(icon("loop"));
  row.loopButton.setAttribute("aria-pressed", "false");
  label(row.loopButton, row, "循环播放");
  row.speedButton = button("speed", () => {
    row.speed = (row.speed + 1) % rates.length;
    if (current === row) audio.playbackRate = rates[row.speed];
    updateSpeed(row);
  });
  row.captionButton = button("captions", () => {
    row.captionState = (row.captionState + 1) % captions.length;
    updateCaptions(row);
  });
  row.captionButton.setAttribute("aria-controls", row.english.id + " " + row.chinese.id);

  controls.append(number, row.playButton, row.loopButton, row.speedButton, row.captionButton);
  item.append(controls, row.english, row.chinese);
  updatePlayback(row);
  updateSpeed(row);
  updateCaptions(row);
  return item;
}

function render(groups) {
  const fragment = document.createDocumentFragment();
  groups.forEach(({ title, lines }, index) => {
    const passage = document.createElement("section");
    passage.className = "passage";
    const heading = document.createElement("h2");
    heading.textContent = title;
    heading.id = "passage-" + (index + 1);
    const list = document.createElement("ol");
    list.className = "sentences";
    list.setAttribute("role", "list");
    list.setAttribute("aria-labelledby", heading.id);
    lines.forEach((line, offset) => list.append(sentence(line, title, index + 1, offset + 1)));
    passage.append(heading, list);
    fragment.append(passage);
  });
  container.replaceChildren(fragment);
}

audio.preservesPitch = true;
audio.addEventListener("loadedmetadata", () => {
  if (!pendingSeek || pendingSeek !== current) return;
  audio.currentTime = pendingSeek.start;
  audio.playbackRate = rates[pendingSeek.speed];
  pendingSeek = null;
  checkEnd();
});
for (const event of ["playing", "seeked", "timeupdate", "ratechange"]) audio.addEventListener(event, checkEnd);
audio.addEventListener("seeking", stopEndTimer);
audio.addEventListener("play", () => updatePlayback(current));
audio.addEventListener("pause", () => {
  if (audio.paused) stopEndTimer();
  updatePlayback(current);
});
audio.addEventListener("ended", () => {
  if (current?.loop) play(current);
});
audio.addEventListener("error", () => announce("音频暂时不可用，请刷新后重试。"));

try {
  render(JSON.parse(embeddedData.textContent));
} catch {
  announce("暂时无法载入听力，请刷新后重试。");
}
