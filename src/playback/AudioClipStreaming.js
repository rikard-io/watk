/**
 * Copyright (c) 2020 Rikard Lindström
 *
 *
 * @TODO long description for the file
 *
 * @summary @TODO short description for the file
 * @author Rikard Lindstrom <hi@rikard.io>
 */

import AudioClip from "./AudioClip";

class AudioClipStreaming extends AudioClip {
  constructor(context, props) {
    super(context, props);
    this.audioElement = new Audio();
    this.audioElement.crossOrigin = "anonymous";
    this.isStreaming = true;
    this.context.once("user-init", () => {
      this.audioElement.play();
      this.audioElement.volume = 0;

      setTimeout(() => {
        this.audioElement.pause();
        setTimeout(() => {
          this.audioElement.volume = 1;
        }, 100);
      }, 50);
    });
  }

  get isPlaying() {
    return (
      this.audioElement.currentTime >= 0 &&
      !this.audioElement.paused &&
      !this.audioElement.ended
    );
  }

  get duration() {
    return this.audioElement.duration || 0;
  }

  setSource(url) {
    this.audioElement.src = url;
  }

  implStart(time = 0, offset = 0, loopCallback = false) {
    if (!this.loaded) {
      throw new Error("Clip has no buffer");
    }

    this.context.cancelCallbacks(
      this._loopCallback,
      this._startCallback,
      this._stopCallback
    );

    if (offset >= this.duration) {
      console.warn("Tried starting audio element after duration");
      offset = this.duration - 0.1;
    }

    time = Math.max(this.context.currentTime, time);

    if (!this.$sourceNode) {
      const sourceNode = this.waContext.createMediaElementSource(
        this.audioElement
      );
      this.$sourceNode = sourceNode;
      this.setupWebAudio();
      this.$sourceNode.connect(this.$automationGain);
    }

    this._scheduleAutomation(time, offset);

    if (this.loop) {
      this._loopCallback = this.context.scheduleRealtimeCallback(
        time + this.loopDuration - offset,
        (time) => {
          if (!this.stopTime || this.stopTime > time) {
            this.implStart(time, 0, true);
          }
        }
      );
    }
    this._startCallback = this.context.scheduleRealtimeCallback(time, () => {
      this.fade.cancelAndHoldAtTime(time);
      this.fade.linearRampToValueAtTime(this.volume, time);
      this.fade.renderToWebAudioParameter(this.$fade.gain, time, time);

      this.audioElement.currentTime = offset;
      this.audioElement.play();

      this.audioElement.onplaying = () => {
        this.audioElement.onplaying = null;
        this.trigger("playing");
      };
    });
  }

  implStop(time = 0) {
    if (!this.$sourceNode) {
      throw new Error(".stop called before .start");
    }
    this._stopCallback = this.context.scheduleRealtimeCallback(time, () => {
      this.audioElement.pause();
    });
  }

  implLoad(url = this.props.url) {
    this.loaded = false;
    return new Promise((resolve, reject) => {
      const errorCallback = (event) => {
        this.audioElement.removeEventListener("canplay", readyCallback, false);
        this.audioElement.removeEventListener("error", errorCallback, false);
        reject(event);
      };
      const readyCallback = () => {
        this.audioElement.removeEventListener("canplay", readyCallback, false);
        this.audioElement.removeEventListener("error", errorCallback, false);
        this.loaded = true;

        resolve(this);
      };
      this.audioElement.addEventListener("canplay", readyCallback, false);
      this.audioElement.addEventListener("error", errorCallback, false);

      this.audioElement.src = url;
      if (typeof this.audioElement.load === "function") {
        this.audioElement.load();
      }
    });
  }
}

export default AudioClipStreaming;
