// Thêm/sửa video trong mảng này để cập nhật danh sách.
const videos = [
  {
    url: "https://www.youtube.com/watch?v=UJU-HNCOSrQ",
    title: "Video 1",
    channel: "Kênh của tôi",
    thumbnail: "https://img.youtube.com/vi/ZjBZ8MUnB0E/hqdefault.jpg",
    channelPicture: "channel-pictures/channel-1.jpeg",
    duration: "",
    stats: "",
  },
  {
    url: "https://www.youtube.com/watch?v=NVzTjiWdjlc",
    title: "Video 2",
    channel: "Kênh của tôi",
    thumbnail: "https://img.youtube.com/vi/Y9Wl-l9wxVE/hqdefault.jpg",
    channelPicture: "channel-pictures/channel-1.jpeg",
    duration: "",
    stats: "",
  },
  {
    url: "https://www.youtube.com/watch?v=jP0DSBXPL3A",
    title: "Video 3",
    channel: "Kênh của tôi",
    thumbnail: "https://img.youtube.com/vi/jP0DSBXPL3A/hqdefault.jpg",
    channelPicture: "channel-pictures/channel-1.jpeg",
    duration: "",
    stats: "",
  },
  {
    url: "https://www.youtube.com/watch?v=jmU_fq-iTSE&list=RDjmU_fq-iTSE&start_radio=1&t=8890s",
    title: "Video 4",
    channel: "Kênh của tôi",
    thumbnail: "https://img.youtube.com/vi/jmU_fq-iTSE/hqdefault.jpg",
    channelPicture: "channel-pictures/channel-1.jpeg",
    duration: "",
    stats: "",
  },
];

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
let progressTimer;
let youtubePlayer;
let selectedVideo = null;
let apiReady = false;

function getVideoId(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname === "youtu.be") return parsedUrl.pathname.slice(1);
    return parsedUrl.searchParams.get("v");
  } catch {
    return null;
  }
}

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
  replayOverlay.hidden = true;
  playerSection.scrollIntoView({ behavior: "smooth", block: "start" });

  if (apiReady) loadSelectedVideo();
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

document.addEventListener("fullscreenchange", () => {
  fullscreenToggle.setAttribute("aria-label", document.fullscreenElement ? "Thoát toàn màn hình" : "Toàn màn hình");
});

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

  const thumbnail = document.createElement("img");
  thumbnail.className = "thumbnail";
  thumbnail.src =
    video.thumbnail ||
    `https://img.youtube.com/vi/${getVideoId(video.url)}/hqdefault.jpg`;
  thumbnail.alt = video.title;
  thumbnailButton.append(thumbnail);
  thumbnailButton.addEventListener("click", () => playVideo(video));
  thumbnailRow.append(thumbnailButton);

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

videoGrid.replaceChildren(...videos.map(createVideoCard));
