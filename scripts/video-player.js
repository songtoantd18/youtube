// Danh sách video khởi tạo; video không nhúng được sẽ tự bị bỏ qua.
const videoUrls = [
  "https://www.youtube.com/watch?v=UJU-HNCOSrQ",
  "https://www.youtube.com/watch?v=NVzTjiWdjlc",
  "https://www.youtube.com/watch?v=jP0DSBXPL3A",
  "https://www.youtube.com/watch?v=jmU_fq-iTSE&list=RDjmU_fq-iTSE&start_radio=1&t=8890s",
];
const VIDEO_URLS_STORAGE_KEY = "youtube-clone-video-urls";
const videos = [];

function getSavedVideoUrls() {
  try {
    const savedUrls = JSON.parse(localStorage.getItem(VIDEO_URLS_STORAGE_KEY) || "null");
    return Array.isArray(savedUrls) ? savedUrls : videoUrls;
  } catch {
    return videoUrls;
  }
}

function saveVideoUrls() {
  try {
    localStorage.setItem(VIDEO_URLS_STORAGE_KEY, JSON.stringify(videos.map((video) => video.url)));
  } catch (error) {
    console.warn("Không thể lưu danh sách video vào localStorage:", error);
  }
}

async function fetchVideoDetails(url) {
  const videoId = getVideoId(url);
  if (!videoId) return null;
  const normalizedUrl = `https://www.youtube.com/watch?v=${videoId}`;

  try {
    const endpoint = `https://www.youtube.com/oembed?url=${encodeURIComponent(normalizedUrl)}&format=json`;
    const response = await fetch(endpoint);
    if (!response.ok) return null; // Video không công khai/không nhúng được: không hiển thị.
    const data = await response.json();
    return {
      url,
      title: data.title,
      channel: data.author_name,
      thumbnail: data.thumbnail_url || `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      channelPicture: "channel-pictures/channel-1.jpeg",
      duration: "",
      stats: "",
    };
  } catch {
    return null;
  }
}

async function addVideoUrl(url) {
  const details = await fetchVideoDetails(url.trim());
  if (!details || videos.some((video) => getVideoId(video.url) === getVideoId(details.url))) return false;
  videos.push(details);
  saveVideoUrls();
  renderVideos();
  return true;
}

function removeVideo(video) {
  const index = videos.findIndex((item) => getVideoId(item.url) === getVideoId(video.url));
  if (index === -1) return;

  videos.splice(index, 1);
  if (selectedVideo && getVideoId(selectedVideo.url) === getVideoId(video.url)) {
    selectedVideo = null;
    playerSection.hidden = true;
    if (youtubePlayer) youtubePlayer.stopVideo();
  }
  saveVideoUrls();
  renderVideos();
}

// Load the IFrame API after registering its callback, avoiding a race with script loading.
const youtubeApiScript = document.createElement("script");
youtubeApiScript.src = "https://www.youtube.com/iframe_api";
document.head.appendChild(youtubeApiScript);

const playerSection = document.querySelector("#video-player-section");
const playerElement = document.querySelector("#video-player");
const playerTitle = document.querySelector("#video-player-title");
const replayOverlay = document.querySelector("#video-player-overlay");
const controls = document.querySelector("#video-player-controls");
const playToggle = document.querySelector("#player-play-toggle");
const seek = document.querySelector("#player-seek");
const muteToggle = document.querySelector("#player-mute-toggle");
const volume = document.querySelector("#player-volume");
const captionsToggle = document.querySelector("#player-captions-toggle");
const playbackRate = document.querySelector("#player-playback-rate");
const fullscreenToggle = document.querySelector("#player-fullscreen-toggle");
const videoGrid = document.querySelector(".video-grid");
const playerWrap = document.querySelector("#video-player-wrap");
let controlsHideTimer;
let progressTimer;
let youtubePlayer;
let selectedVideo = null;
let apiReady = false;

function getVideoId(url) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");
    if (hostname === "youtu.be") return parsedUrl.pathname.slice(1);
    if (hostname !== "youtube.com" && hostname !== "m.youtube.com") return null;
    return parsedUrl.searchParams.get("v");
  } catch {
    return null;
  }
}

function renderVideos() {
  videoGrid.replaceChildren(...videos.map(createVideoCard));
}

const addVideoForm = document.querySelector("#add-video-form");
const addVideoSection = document.querySelector("#add-video-section");
const addVideoTrigger = document.querySelector("#add-video-trigger");
const videoUrlInput = document.querySelector("#video-url-input");

addVideoTrigger.addEventListener("click", () => {
  const isOpening = addVideoSection.hidden;
  addVideoSection.hidden = !isOpening;
  addVideoTrigger.setAttribute("aria-expanded", String(isOpening));
  if (isOpening) videoUrlInput.focus();
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !addVideoSection.hidden) {
    addVideoSection.hidden = true;
    addVideoTrigger.setAttribute("aria-expanded", "false");
    addVideoTrigger.focus();
  }
});

const addVideoMessage = document.querySelector("#add-video-message");
addVideoForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  addVideoMessage.textContent = "Đang kiểm tra link...";
  const added = await addVideoUrl(videoUrlInput.value);
  addVideoMessage.textContent = added
    ? "Đã thêm video."
    : "Không thể thêm video: link không hợp lệ, video không công khai/không nhúng được, hoặc đã có trong danh sách.";
  if (added) videoUrlInput.value = "";
});

async function loadInitialVideos() {
  const urls = getSavedVideoUrls();
  const details = await Promise.all(urls.map(fetchVideoDetails));
  videos.push(...details.filter(Boolean));

  // Bỏ URL không hợp lệ hoặc video đã bị gỡ/không nhúng được khỏi localStorage.
  if (details.some((video) => video === null)) saveVideoUrls();
  renderVideos();
}
loadInitialVideos();

// Called by YouTube's IFrame Player API when the API script has loaded.
window.onYouTubeIframeAPIReady = function () {
  apiReady = true;
  youtubePlayer = new YT.Player(playerElement, {
    playerVars: {
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      fs: 0,
      rel: 0,
      playsinline: 1,
      enablejsapi: 1,
    },
    events: {
      onReady() {
        controls.hidden = false;
        if (selectedVideo) loadSelectedVideo();
        clearInterval(progressTimer);
        progressTimer = setInterval(updateProgress, 500);
      },
      onStateChange(event) {
        if (event.data === YT.PlayerState.ENDED) {
          if (playNextVideo()) return;
          replayOverlay.hidden = false;
          playToggle.textContent = "▶";
        } else if (event.data === YT.PlayerState.PLAYING) {
          replayOverlay.hidden = true;
          playToggle.textContent = "⏸";
        } else if (event.data === YT.PlayerState.PAUSED) {
          playToggle.textContent = "▶";
        }
      },
    },
  });
};

function loadSelectedVideo() {
  if (
    !apiReady ||
    !youtubePlayer ||
    !selectedVideo ||
    typeof youtubePlayer.loadVideoById !== "function"
  )
    return;
  const videoId = getVideoId(selectedVideo.url);
  if (!videoId) return;

  replayOverlay.hidden = true;
  youtubePlayer.loadVideoById(videoId);
}

function playVideo(video) {
  if (!getVideoId(video.url)) return;
  selectedVideo = video;
  playerTitle.textContent = video.title;
  playerSection.hidden = false;
  document.querySelector("main").classList.add("video-playing-layout");
  replayOverlay.hidden = true;
  playerSection.scrollIntoView({ behavior: "smooth", block: "start" });

  if (apiReady) loadSelectedVideo();
}

// Tự chuyển video kế tiếp: chỉ đổi nguồn phát và tiêu đề, không cuộn trang
// và không đổi layout (tránh vỡ giao diện, nhất là khi đang toàn màn hình).
function playNextVideo() {
  if (!selectedVideo) return false;
  const currentId = getVideoId(selectedVideo.url);
  const index = videos.findIndex((video) => getVideoId(video.url) === currentId);
  if (index === -1) return false;
  // Phát vòng tròn: hết video cuối thì quay lại video đầu tiên.
  const next = videos[(index + 1) % videos.length];
  if (!next || !getVideoId(next.url)) return false;

  selectedVideo = next;
  playerTitle.textContent = next.title;
  loadSelectedVideo();
  return true;
}

replayOverlay.addEventListener("click", () => {
  if (!youtubePlayer || !selectedVideo) return;
  replayOverlay.hidden = true;
  youtubePlayer.seekTo(0, true);
  youtubePlayer.playVideo();
});

function updateProgress() {
  if (!youtubePlayer || typeof youtubePlayer.getDuration !== "function") return;
  const duration = youtubePlayer.getDuration();
  if (duration > 0) seek.value = String(Math.round((youtubePlayer.getCurrentTime() / duration) * 1000));
  muteToggle.textContent = youtubePlayer.isMuted() ? "🔇" : "🔊";
  const currentVolume = youtubePlayer.getVolume();
  if (Number(volume.value) !== currentVolume) volume.value = String(currentVolume);
}

playToggle.addEventListener("click", () => {
  if (!youtubePlayer) return;
  if (youtubePlayer.getPlayerState() === YT.PlayerState.PLAYING) youtubePlayer.pauseVideo();
  else youtubePlayer.playVideo();
});

seek.addEventListener("input", () => {
  if (!youtubePlayer) return;
  const duration = youtubePlayer.getDuration();
  if (duration > 0) youtubePlayer.seekTo((Number(seek.value) / 1000) * duration, true);
});

muteToggle.addEventListener("click", () => {
  if (!youtubePlayer) return;
  if (youtubePlayer.isMuted()) youtubePlayer.unMute();
  else youtubePlayer.mute();
  updateProgress();
});

volume.addEventListener("input", () => youtubePlayer?.setVolume(Number(volume.value)));
captionsToggle.addEventListener("click", () => {
  if (!youtubePlayer) return;
  const track = youtubePlayer.getOption("captions", "track");
  if (track?.languageCode) youtubePlayer.unloadModule("captions");
  else youtubePlayer.loadModule("captions");
});
playbackRate.addEventListener("change", () => youtubePlayer?.setPlaybackRate(Number(playbackRate.value)));
fullscreenToggle.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.querySelector("#video-player-wrap").requestFullscreen();
  } catch (error) {
    console.warn("Không thể bật toàn màn hình:", error);
  }
});

function showPlayerControls() {
  playerWrap.classList.add("controls-visible");
  clearTimeout(controlsHideTimer);
  controlsHideTimer = setTimeout(hidePlayerControls, 1800);
}

function hidePlayerControls() {
  playerWrap.classList.remove("controls-visible");
}

playerWrap.addEventListener("pointermove", (event) => {
  if (event.pointerType === "mouse") showPlayerControls();
});
playerWrap.addEventListener("mouseleave", () => {
  clearTimeout(controlsHideTimer);
  hidePlayerControls();
});
controls.addEventListener("pointermove", showPlayerControls);
controls.addEventListener("click", () => {
  clearTimeout(controlsHideTimer);
  controlsHideTimer = setTimeout(hidePlayerControls, 1800);
});
controls.addEventListener("focusin", () => {
  clearTimeout(controlsHideTimer);
  playerWrap.classList.add("controls-visible");
});
controls.addEventListener("focusout", showPlayerControls);

playerWrap.addEventListener("touchstart", () => {
  playerWrap.classList.add("touch-controls-visible");
  clearTimeout(controlsHideTimer);
  controlsHideTimer = setTimeout(() => playerWrap.classList.remove("touch-controls-visible"), 2500);
}, { passive: true });

window.addEventListener("mousemove", () => playerWrap.classList.remove("touch-controls-visible"));

document.addEventListener("fullscreenchange", () => {
  const isFullscreen = document.fullscreenElement === playerWrap;
  fullscreenToggle.setAttribute("aria-label", isFullscreen ? "Thoát toàn màn hình" : "Toàn màn hình");
  hidePlayerControls();
  playerWrap.classList.remove("touch-controls-visible");
  clearTimeout(controlsHideTimer);
});

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    hidePlayerControls();
    playerWrap.classList.remove("touch-controls-visible");
  }
});

window.addEventListener("blur", hidePlayerControls);

controls.addEventListener("pointerenter", () => clearTimeout(controlsHideTimer));
controls.addEventListener("pointerleave", showPlayerControls);

playerWrap.addEventListener("pointerdown", (event) => {
  if (event.pointerType !== "mouse") {
    playerWrap.classList.toggle("touch-controls-visible");
  }
});

playerWrap.addEventListener("click", showPlayerControls);

function createVideoCard(video) {
  const card = document.createElement("article");
  card.className = "video-preview";

  const thumbnailRow = document.createElement("div");
  thumbnailRow.className = "thumbnail-row";

  const thumbnailButton = document.createElement("button");
  thumbnailButton.className = "video-title-link video-thumbnail-button";
  thumbnailButton.type = "button";
  thumbnailButton.setAttribute("aria-label", `Phát video: ${video.title}`);
  thumbnailButton.style.cssText =
    "display:block;width:100%;padding:0;border:0;background:none;cursor:pointer;text-align:left;";

  const removeButton = document.createElement("button");
  removeButton.className = "video-remove-button";
  removeButton.type = "button";
  removeButton.textContent = "×";
  removeButton.setAttribute("aria-label", `Xóa video: ${video.title}`);
  removeButton.title = "Xóa video";
  removeButton.addEventListener("click", () => {
    if (window.confirm(`Bạn có chắc muốn xóa video “${video.title}” khỏi danh sách không?`)) {
      removeVideo(video);
    }
  });

  const thumbnail = document.createElement("img");
  thumbnail.className = "thumbnail";
  thumbnail.src =
    video.thumbnail ||
    `https://img.youtube.com/vi/${getVideoId(video.url)}/hqdefault.jpg`;
  thumbnail.alt = video.title;
  thumbnailButton.append(thumbnail);
  thumbnailButton.addEventListener("click", () => playVideo(video));
  thumbnailRow.append(thumbnailButton, removeButton);

  if (video.duration) {
    const duration = document.createElement("div");
    duration.className = "video-time";
    duration.textContent = video.duration;
    thumbnailRow.append(duration);
  }

  const infoGrid = document.createElement("div");
  infoGrid.className = "video-info-grid";
  const channelPicture = document.createElement("div");
  channelPicture.className = "channel-picture";
  const profilePicture = document.createElement("img");
  profilePicture.className = "profile-picture";
  profilePicture.src =
    video.channelPicture || "channel-pictures/channel-1.jpeg";
  profilePicture.alt = video.channel;
  channelPicture.append(profilePicture);

  const info = document.createElement("div");
  info.className = "video-info";
  const titleButton = document.createElement("button");
  titleButton.className = "video-title-link video-title-button";
  titleButton.type = "button";
  titleButton.style.cssText =
    "display:block;padding:0;border:0;background:none;text-align:left;cursor:pointer;";
  const title = document.createElement("p");
  title.className = "video-title";
  title.textContent = video.title;
  titleButton.append(title);
  titleButton.addEventListener("click", () => playVideo(video));

  const author = document.createElement("p");
  author.className = "video-author";
  author.textContent = video.channel;
  info.append(titleButton, author);

  if (video.stats) {
    const stats = document.createElement("p");
    stats.className = "video-stats";
    stats.textContent = video.stats;
    info.append(stats);
  }

  infoGrid.append(channelPicture, info);
  card.append(thumbnailRow, infoGrid);
  return card;
}

