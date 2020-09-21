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
import downSample from "../utils/downSample";

class AudioClipBuffered extends AudioClip {
  get duration() {
    return this.$buffer ? this.$buffer.duration : 0;
  }

  get isPlaying() {
    const now = this.context.currentTime;
    if (this.startTime === null) return false;
    if (this.startTime > now) return false;
    if (this.stopTime === null) {
      if (this.loop) {
        return true;
      }
      return now < this.startTime + this.duration;
    }
    return this.startTime <= now && this.stopTime > now;
  }

  setBuffer(buffer) {
    this.$buffer = buffer;
  }

  implStart(time = 0, offset = 0) {
    if (!this.$buffer) {
      throw new Error("Clip has no buffer");
    }

    time = Math.max(this.context.currentTime, time);

    if (this.$sourceNode && this.stopTime <= time) {
      this.$sourceNode.onended = null;

      try {
        this.$sourceNode.stop(time);
      } catch (e) {
        console.error(e);
        // state error, most likely already stopped
        // sacrifice the automation gain to mute it
        this.$automationGain.gain.cancelScheduledValues(time);
        this.$automationGain.gain.setTargetAtTime(0, time, 0.01);
        this.___$automationGain = this.$automationGain;
        this.$automationGain = null;
      }
    }
    const sourceNode = this.waContext.createBufferSource();
    this.$sourceNode = sourceNode;
    this.$sourceNode.buffer = this.$buffer;
    this.$sourceNode.onended = () => this.handleSourceEnded(sourceNode);

    this.setupWebAudio();
    this.$sourceNode.connect(this.$automationGain);

    this._scheduleAutomation(time, offset);

    if (this.loop) {
      if (this.loopDuration - this.$buffer.duration < 0.0005) {
        this.$sourceNode.loop = true;
        this.$sourceNode.loopStart = this.loopStart;
        this.$sourceNode.loopEnd = this.loopEnd;
      } else {
        this.context.scheduleCallback(
          time + this.loopDuration - offset,
          (time) => {
            if (!this.stopTime || this.stopTime > time) {
              if (!this.$sourceNode) {
                debugger;
                throw new Error("clip has no $sourceNode");
              }
              // this.$sourceNode.stop(time);
              this.implStart(time, 0, true);
              if (this.stopTime) {
                this.$sourceNode.stop(this.stopTime);
              }
            }
          }
        );
      }
    }
    this.fade.cancelAndHoldAtTime(time);
    this.fade.linearRampToValueAtTime(this.volume, time);
    this.fade.renderToWebAudioParameter(this.$fade.gain, time, time);
    this.$sourceNode.start(time, offset);
  }

  implStop(time = 0) {
    if (!this.$sourceNode) {
      throw new Error(".stop called before .start");
    }
    this.$sourceNode.__stopped = true;
    this.$sourceNode.stop(time);
  }

  implLoad(url = this.props.url) {
    return this.context.loadBuffer(url).then((buffer) => {
      this.$buffer = buffer;
      return this;
    });
  }

  handleSourceEnded(sourceNode) {
    if (sourceNode !== this.$sourceNode) {
      sourceNode.disconnect();
      console.warn(
        "handleSourceEnded callback called for non active sourceNode. Bug?"
      );
      return;
    }
    this.$sourceNode.disconnect();
    this.$automationGain.disconnect();
    this.$fade.disconnect();
    this.nodeChain.forEach((node) => node.disconnect());
    this.$sourceNode = null;
    this.$automationGain = null;
    this.$fade = null;
  }

  async downSample(ratio, mono) {
    if (this.$buffer) {
      this.$buffer = await downSample(
        this.$buffer,
        Math.floor(this.context.sampleRate * ratio),
        mono
      );
    } else {
      throw new Error("Clip doesn't have a buffer");
    }
  }
}

export default AudioClipBuffered;
