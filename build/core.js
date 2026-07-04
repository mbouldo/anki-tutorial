
    // Elements
    const video = document.getElementById("player");
    const caption = document.getElementById("caption");
    const prevBtn = document.getElementById("prevBtn");
    const nextBtn = document.getElementById("nextBtn");
    const progressBar = document.getElementById("progressBar");
    const currentStepBox = document.getElementById("currentStepBox");
    const playerWrap = document.getElementById("playerWrap");
    const expandToFullScreenBtn = document.getElementById("expandToFullScreenBtn");

    // init globals
    let isMax = false;
    let targetStop = 0;          // where we currently are / are heading in the keyframe set

    let watchedStops = new Set([0]); // stores the indexes reached (if wanted to mark some as incomplete)
    let playController = null;   // in-flight transition controller

    // Fullscreen Control
    function setFullscreenState(nextIsMax) {
      isMax = nextIsMax;

      playerWrap.className = isMax
        ? "fixed inset-0 z-50 bg-black overflow-hidden"
        : "aspect-video w-full overflow-hidden relative rounded-xl bg-black";
    }
    expandToFullScreenBtn.addEventListener("click", () => {
      setFullscreenState(!isMax);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && isMax) {
        setFullscreenState(false);
      }
    });

    // right/left navigation buttons:
    const btnStyles = {
          base: `
            absolute top-1/2 -translate-y-1/2 z-10
            rounded-full px-3 py-3 select-none
            transition-all duration-300
            focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-blue-400
            focus-visible:ring-offset-2 focus-visible:ring-offset-black
          `,

          prev: {
            active: `
              left-3
              bg-black/60 text-white
              hover:bg-black/80
              cursor-pointer
            `,
            idle: `
              left-3
              bg-black/40 text-white/50
              hover:bg-black/50
              cursor-default
            `,
          },

          next: {
            ready: `
              right-3
              bg-blue-500 text-white
              hover:bg-blue-600
              cursor-pointer
              scale-110
              next-ready
            `,
            busy: `
              right-3
              bg-black/60 text-white
              hover:bg-black/80
              cursor-pointer
            `,
            done: `
              right-3
              bg-black/40 text-white/50
              hover:bg-black/50
              cursor-default
            `,
          },
    };

    function updateNavButtons() {
      const busy = !!playController;
      const atStart = targetStop === 0;
      const atEnd = targetStop === CONFIG_VIDEO_STOPS.length - 1;

      if (atStart && !busy) {
        prevBtn.className = `${btnStyles.base} ${btnStyles.prev.idle}`;
      } else {
        prevBtn.className = `${btnStyles.base} ${btnStyles.prev.active}`;
      }

      if (busy) {
        nextBtn.className = `${btnStyles.base} ${btnStyles.next.busy}`;
      } else if (atEnd) {
        nextBtn.className = `${btnStyles.base} ${btnStyles.next.done}`;
      } else {
        nextBtn.className = `${btnStyles.base} ${btnStyles.next.ready}`;
      }
    }

    // caption controller + formatter

function formatCaption(text) {
  // 1. convert escaped asterisk into placeholder
  text = text.replace(/\\\*/g, "__ESC_STAR__");

  // 2. bold
  text = text.replace(/\*(.+?)\*/g, "<strong>$1</strong>");

  // 3. restore literal *
  text = text.replace(/__ESC_STAR__/g, "*");

  return text;
}

    function showCaption(text) {
      if (text) {
        caption.innerHTML = formatCaption(text);

        caption.classList.remove("opacity-0", "translate-y-2");
        caption.classList.add("opacity-100", "translate-y-0");
      } else {
        caption.classList.add("opacity-0", "translate-y-2");
        caption.classList.remove("opacity-100", "translate-y-0");
      }
    }

    // Progress Bar Segements

    function markupInitProgressBars() {
      progressBar.innerHTML = "";

      CONFIG_VIDEO_STOPS.forEach((stop, i) => {
        const progressSegment = document.createElement("div");
        progressSegment.className =
          `relative w-[30px] h-[4px] rounded-sm bg-zinc-300/70 overflow-hidden transition-transform duration-200 hover:scale-110 `; //cursor-pointer
        progressSegment.dataset.index = i;

        const fill = document.createElement("div");
        fill.className = "absolute inset-y-0 left-0 bg-blue-500 rounded-sm";
        fill.style.width = "0%";

        progressSegment.appendChild(fill);
        //progressSegment.addEventListener("click", () => jumpToStopIndex(i));

        progressBar.appendChild(progressSegment);
      });

      targetStop = 0;
    
      watchedStops = new Set([0]);
      updateProgress(1);
    }

    // activeFill: how "full" the current (targetStop) segment is, 0..1, while animating.
      function updateProgress(activeFillFraction = 1) {
        const children = progressBar.children;

        for (let i = 0; i < children.length; i++) {
          const seg = children[i];
          const fill = seg.firstElementChild;
          const stop = CONFIG_VIDEO_STOPS[i];

          seg.classList.remove(
            "scale-110",
            "ring-2",
            "ring-blue-300",
            "next-suggest-progress-segment"
          );

          const isPast = i < targetStop;
          const isCurrent = i === targetStop;

          const watched = watchedStops.has(i) || i < targetStop;

          if (isPast) {
            fill.style.width = "100%";
            fill.className = "absolute inset-y-0 left-0 bg-blue-500 rounded-sm";
          } else if (isCurrent) {
            const fillPercent = Math.max(0, Math.min(1, activeFillFraction)) * 100;

            fill.style.width = fillPercent + "%";
            fill.className = watched
              ? "absolute inset-y-0 left-0 bg-blue-500 rounded-sm"
              : "absolute inset-y-0 left-0 bg-orange-500 rounded-sm";

            seg.classList.add("scale-110", "ring-2", "ring-blue-300");
          } else {
            fill.style.width = "0%";

            if (i === targetStop + 1 &&  !playController) {
              seg.classList.add("next-suggest-progress-segment");
            }
          }
        }

        currentStepBox.textContent =
          (targetStop + 1) + " / " + CONFIG_VIDEO_STOPS.length;
      }

    // ---------- Navigation ----------
    function clampToValidStopIndex(index, maxIndex) {
      // ensures requested stop is always within valid bounds [0, maxIndex]
      return Math.max(0, Math.min(maxIndex, index));
    }

    // Instant jump — used for manual skips (segments, prev, busy-state next-skip).
    function jumpToStopIndex(requestedJumpIndex, { markWatched = false } = {}) {
      if (playController) { // there is an active "PLAYING" - abort it, and reset controller.
        playController.abort();
        playController = null;
      }

      targetStop = clampToValidStopIndex(requestedJumpIndex, CONFIG_VIDEO_STOPS.length - 1)

      video.pause();
      video.currentTime = CONFIG_VIDEO_STOPS[targetStop].t; // sync video with expected CONFIG STOP Timeframe you just jumped to.
      showCaption(CONFIG_VIDEO_STOPS[targetStop].text);
  
      if (markWatched) watchedStops.add(targetStop);

      updateProgress(1);
      updateNavButtons();
    }

    // Animated transition — plays the footage between the current stop and the next one.
    function playToNextStop() {
      const nextStop = targetStop + 1;
      if (nextStop >= CONFIG_VIDEO_STOPS.length) return;

      if (playController) playController.abort();
      playController = new AbortController();
      const { signal } = playController;
      const thisController = playController; // snapshot, to detect being superseded

      const fromTime = CONFIG_VIDEO_STOPS[targetStop].t;
      const targetTime = CONFIG_VIDEO_STOPS[nextStop].t;
      let currentClipLength = targetTime - fromTime;
      if (currentClipLength <= 0) {
        currentClipLength = 0.0001;
      }

      targetStop = nextStop;
     
      updateProgress(0);
      updateNavButtons();
      showCaption("");

      function onPlaybackTick() {
        if (signal.aborted) return;

        const elapsed = video.currentTime - fromTime;
        updateProgress(elapsed / currentClipLength);

        if (video.currentTime >= targetTime) {
          video.pause();

          const onSeeked = () => {
            video.removeEventListener("seeked", onSeeked);
            if (playController !== thisController) return; // a newer transition/jump took over — don't act on stale state
            watchedStops.add(targetStop);
            showCaption(CONFIG_VIDEO_STOPS[targetStop].text);
            playController = null;
            updateProgress(1);
            updateNavButtons();
          };
          video.addEventListener("seeked", onSeeked, { once: true });
          video.currentTime = targetTime; // seek back to the exact stop point

          playController.abort(); // stops the rVFC loop + the ended/pause cleanup listeners
          return;
        }
        video.requestVideoFrameCallback(onPlaybackTick);
      }

      video.requestVideoFrameCallback(onPlaybackTick);

      // Also clean up if the video ends or is paused externally
      video.addEventListener("ended", () => playController?.abort(), { signal });
      video.addEventListener("pause",  () => playController?.abort(), { signal });

      video.play();
    }

    // VIDEO CONTROLS:
    nextBtn.addEventListener("click", () => {
      if (playController) {
        jumpToStopIndex(Math.min(targetStop + 1, CONFIG_VIDEO_STOPS.length - 1));
        return;
      }
      if (targetStop === CONFIG_VIDEO_STOPS.length - 1) return; // already at the final keyframe
      playToNextStop();
    });

    prevBtn.addEventListener("click", () => {
      if (playController) {
        jumpToStopIndex(Math.max(targetStop - 1, 0));
        return;
      }
      if (targetStop === 0) return;
      jumpToStopIndex(targetStop - 1);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") nextBtn.click();
      if (e.key === "ArrowLeft")  prevBtn.click();
    });


    // ---------- Init ----------
    function init() {
      // Add final stop for video tmax
        CONFIG_VIDEO_STOPS.push({
          t: video.duration-0.25,
          text: "(Done)"
        });
      markupInitProgressBars();
      jumpToStopIndex(0, { markWatched: true });
      updateNavButtons();
    }

    video.addEventListener("loadedmetadata", init);
    if (video.readyState >= 1) init();