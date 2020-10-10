/**
 * Copyright (c) 2020 Rikard Lindström
 *
 *
 * Base class for Clips. Subclass and implement the implX methods
 *
 * @summary Base class for Clip.
 * @author Rikard Lindstrom <hi@rikard.io>
 */
import eventMixin from "../aux/eventMixin";

import Parameter from "../automation/Parameter";

let idCounter = 0;
const defaultProps = {
  id: null,
  url: null,
  loop: false,
  loopStart: 0,
  loopEnd: 0,
  gainAutomation: null,
  volume: 1,
};

class ClipBase {
  constructor(context, props) {
    this.context = context;
    this.stopTime = null;
    this.startTime = null;
    this.props = Object.assign({}, defaultProps, props);
    if (typeof props.loop === "number") {
      this.props.loopEnd = props.loop;
      this.props.loop = true;
    }
    this.props.id = this.props.id || `clip-${++idCounter}`;

    this.gain = new Parameter(context);
    this.fade = new Parameter(context);
    this.destinations = [];
    this.nodeChain = [];
    this.loopCount = 0;

    if (props.gain) {
      if (props.gain.envelope) {
        this.gain.setEnvelope(props.gain.envelope);
      }
      if (props.gain.loop) {
        if (typeof props.gain.loop === "number") {
          this.gain.setLoop(props.gain.loopStart || 0, props.gain.loop);
        } else {
          this.gain.setLoop(props.gain.loopStart || 0, props.gain.loopEnd);
        }
      }
    }
  }

  get url() {
    return this.props.url;
  }

  get loopDuration() {
    return this.loopEnd - this.loopStart;
  }

  get waContext() {
    return this.context.waContext;
  }

  get id() {
    return this.props.id;
  }

  set id(value) {
    this.props.id = value;
  }

  get loop() {
    return this.props.loop;
  }

  set loop(value) {
    this.props.loop = value;
  }

  get loopStart() {
    return this.props.loopStart;
  }

  set loopStart(value) {
    this.props.loopStart = value;
  }

  get loopEnd() {
    return !this.props.loopEnd ? this.duration : this.props.loopEnd;
  }

  set loopEnd(value) {
    this.props.loopEnd = value;
  }

  get volume() {
    return this.props.volume;
  }

  set volume(value) {
    this.props.volume = value;
  }

  setLoop(start, end) {
    this.loopStart = start;
    this.loopEnd = end;
    this.loop = true;
    return this;
  }

  start(time = 0, offset = 0) {
    this.startTime = Math.max(time, this.context.currentTime);
    this.stopTime = null;
    this.startOffset = offset;
    this.implStart(time, offset);
    return this;
  }

  stop(time) {
    this.stopTime = Math.max(time, this.context.currentTime);
    this.implStop(time);
    return this;
  }

  fadeIn(startTime, duration) {
    this.implFade(startTime, duration, 0, this.volume);
    return this;
  }

  fadeOut(startTime, duration) {
    this.implFade(startTime, duration, this.volume, 0);
    return this;
  }

  load(url = this.props.url) {
    this.props.url = url;
    return this.implLoad(url).then(() => this);
  }

  setupWebAudio() {
    if (!this.$fade) {
      this.$fade = this.waContext.createGain();
      this.$fade.gain.value = this.volume;
      let finalNode = this.$fade;
      this.nodeChain.forEach((node) => {
        finalNode.connect(node.$input || node);
        finalNode = node;
      });
      if (this.destinations.length === 0) {
        finalNode.connect(this.context.$master);
      } else {
        this.destinations.forEach((d) => {
          finalNode.connect(d.$input || d);
        });
      }
      this.$output = finalNode;
    }
    if (!this.$automationGain) {
      this.$automationGain = this.waContext.createGain();
      this.$automationGain.connect(this.$fade);
    }
  }

  disconnect(destination) {
    if (this.$output) {
      this.$output.disconnect(destination);
    }
    if (destination) {
      this.destinations = this.destinations.filter((dest) => dest !== destination);
    } else {
      this.destinations.splice(0);
    }
    return this;
  }

  connect(destination) {
    this.destinations.push(destination);
    if (this.$output) {
      this.$output.connect(destination);
    }
    return this;
  }

  _scheduleAutomation(time, offset, isLoopTrigg = false) {
    if (isLoopTrigg) {
      this.loopCount++;
    } else {
      this.loopCount = 0;
    }

    const _offset = offset + this.loop ? this.loopDuration * this.loopCount : 0;
    const duration = this.loop ? this.loopDuration : this.duration;
    this.gain.renderToWebAudioParameter(this.$automationGain.gain, time, _offset, duration);

    if (this.loop) {
      this.context.scheduleCallback(time + this.loopDuration - offset, (time) => {
        if (!this.stopTime || this.stopTime > time) {
          this._scheduleAutomation(time, 0, true);
        }
      });
    }
  }

  addNode(node) {
    this.nodeChain.push(node);
  }

  implFade(startTime, duration, from, to) {
    if (this.fade.events.length) {
      this.fade.cancelAndHoldAtTime(startTime);
    } else {
      this.fade.setValueAtTime(from, startTime);
    }
    this.fade.linearRampToValueAtTime(to, startTime + duration);
    if (this.$fade) {
      this.$fade.gain.cancelScheduledValues(startTime);
      this.fade.renderToWebAudioParameter(this.$fade.gain, startTime, startTime, duration);
    }
  }
}

Object.assign(ClipBase.prototype, eventMixin);

export default ClipBase;
