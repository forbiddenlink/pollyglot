import WaveSurfer from 'wavesurfer.js'

/**
 * Create an audio player with waveform visualization
 * @param {HTMLElement} container - DOM element to render the waveform
 * @param {string} audioUrl - URL of the audio file
 * @param {object} options - Optional configuration
 * @returns {object} Player controls
 */
export function createAudioPlayer(container, audioUrl, options = {}) {
  const wavesurfer = WaveSurfer.create({
    container,
    waveColor: options.waveColor ?? '#4F4A85',
    progressColor: options.progressColor ?? '#383351',
    cursorColor: options.cursorColor ?? '#4299e1',
    cursorWidth: 2,
    barWidth: 2,
    barGap: 1,
    barRadius: 2,
    height: options.height ?? 80,
    url: audioUrl,
  })

  // Handle ready event
  const readyPromise = new Promise((resolve) => {
    wavesurfer.on('ready', resolve)
  })

  return {
    wavesurfer,
    ready: readyPromise,
    play: () => wavesurfer.play(),
    pause: () => wavesurfer.pause(),
    playPause: () => wavesurfer.playPause(),
    stop: () => {
      wavesurfer.pause()
      wavesurfer.seekTo(0)
    },
    isPlaying: () => wavesurfer.isPlaying(),
    getDuration: () => wavesurfer.getDuration(),
    getCurrentTime: () => wavesurfer.getCurrentTime(),
    seekTo: (progress) => wavesurfer.seekTo(progress),
    setVolume: (volume) => wavesurfer.setVolume(volume),
    destroy: () => wavesurfer.destroy(),
    on: (event, callback) => wavesurfer.on(event, callback),
  }
}

/**
 * Create an audio player for pronunciation practice
 * Includes play button and waveform in a styled container
 * @param {HTMLElement} parent - Parent element to append the player
 * @param {string} audioUrl - URL of the pronunciation audio
 * @returns {object} Player instance with DOM elements
 */
export function createPronunciationPlayer(parent, audioUrl) {
  // Create container
  const container = document.createElement('div')
  container.className = 'pronunciation-player'
  container.innerHTML = `
    <button type="button" class="pronunciation-play-btn" aria-label="Play pronunciation">
      <svg class="play-icon" viewBox="0 0 24 24" width="20" height="20">
        <path fill="currentColor" d="M8 5v14l11-7z"/>
      </svg>
      <svg class="pause-icon" viewBox="0 0 24 24" width="20" height="20" style="display:none">
        <path fill="currentColor" d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
      </svg>
    </button>
    <div class="pronunciation-waveform"></div>
  `
  parent.appendChild(container)

  const waveformEl = container.querySelector('.pronunciation-waveform')
  const playBtn = container.querySelector('.pronunciation-play-btn')
  const playIcon = container.querySelector('.play-icon')
  const pauseIcon = container.querySelector('.pause-icon')

  const player = createAudioPlayer(waveformEl, audioUrl, {
    height: 40,
    waveColor: 'rgba(66, 153, 225, 0.4)',
    progressColor: '#4299e1',
  })

  // Toggle play/pause on button click
  playBtn.addEventListener('click', () => {
    player.playPause()
  })

  // Update button state on play/pause
  player.on('play', () => {
    playIcon.style.display = 'none'
    pauseIcon.style.display = 'block'
  })

  player.on('pause', () => {
    playIcon.style.display = 'block'
    pauseIcon.style.display = 'none'
  })

  player.on('finish', () => {
    playIcon.style.display = 'block'
    pauseIcon.style.display = 'none'
  })

  return {
    ...player,
    container,
    remove: () => {
      player.destroy()
      container.remove()
    },
  }
}
