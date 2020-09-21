const defaultProps = {
  offset: () => Math.random(),
  spread: 0.1,
  attack: 0.05,
  decay: 0.1,
  volume: () => Math.random() * 0.5 + 0.5,
  pan: () => Math.random() * 2 - 1,
  transpose: 0,
  density: 100,
};

let idGen = 0;

class GranularSynthGrain {
  constructor({ waContext, $output, $buffer }) {
    this.$output = waContext.createStereoPanner();
    this.$gain = waContext.createGain();

    this.$gain.connect(this.$output);
    this.$buffer = $buffer;
    this.waContext = waContext;
    this.$output.connect($output);
  }

  start(time, offset, attack, sustain, release, pan, transpose = 0, onEnded) {
    const $source = this.waContext.createBufferSource();
    $source.buffer = this.$buffer;
    $source.connect(this.$gain);

    this.$gain.gain.cancelScheduledValues(time);
    this.$gain.gain.setValueAtTime(0, time);
    this.$gain.gain.linearRampToValueAtTime(sustain, time + attack);
    this.$gain.gain.linearRampToValueAtTime(0, time + attack + release);

    this.$output.pan.cancelScheduledValues(time);
    this.$output.pan.setValueAtTime(pan, time);
    $source.playbackRate.value = 2 ** (transpose / 12);
    $source.start(time, offset, attack + release);
    $source.onended = (e) => {
      $source.onended = null;
      $source.disconnect();
      onEnded(this);
    };
  }
}
class GranularSynth {
  constructor(context, props) {
    this.context = context;
    this.props = Object.assign({}, defaultProps, props);
    this.grainPool = [];
    this.props.id = this.props.id || `granny-${idGen++}`;
    this.gain = 1;
  }

  setGain(gain) {
    if (this.$output) {
      this.$output.value = gain;
    }
    this.gain = gain;
    return this;
  }

  get id() {
    return this.props.id;
  }

  get waContext() {
    return this.context.waContext;
  }

  getPooledGrain() {
    if (this.grainPool.length > 0) {
      return this.grainPool.pop();
    } else {
      return new GranularSynthGrain(this);
    }
  }

  getPropAt(time, prop) {
    const p = this.props[prop];
    if (typeof p === "function") {
      return p(time);
    } else {
      return p;
    }
  }

  getPropsAt(time, ...props) {
    return props.map((prop) => this.getPropAt(time, prop));
  }

  start(time) {
    const currentTime = this.context.currentTime;
    time = Math.max(time, currentTime);
    const scheduleInterval = 0.2;

    this.$output = this.waContext.createGain();
    this.$output.connect(this.context.$master);
    this.$output.gain.value = this.gain;

    const loop = (time) => {
      if (time < this.context.currentTime) {
        throw new Error("underflow");
      }

      const density = this.getPropAt(time, "density");
      const numToSchedule = density * scheduleInterval;
      const duration = this.$buffer.duration;
      for (let i = 0; i < numToSchedule; i++) {
        const _time = time + Math.random() * scheduleInterval;

        const [
          offset,
          spread,
          attack,
          volume,
          decay,
          pan,
          transpose,
        ] = this.getPropsAt(
          time,
          "offset",
          "spread",
          "attack",
          "volume",
          "decay",
          "pan",
          "transpose"
        );

        const grain = this.getPooledGrain();
        const _spread = duration * spread;
        const _offset = Math.max(
          0,
          Math.min(
            this.$buffer.duration - (attack + decay),
            offset * duration + Math.random() * _spread * 2 - _spread
          )
        );
        grain.start(
          _time,
          _offset,
          attack,
          volume,
          decay,
          pan,
          transpose,
          (grain) => {
            this.grainPool.push(grain);
          }
        );
      }
      this.context.scheduleCallback(time + scheduleInterval, loop);
    };

    if (time === currentTime) {
      loop(this.context.currentTime);
    } else {
      this.context.scheduleCallback(time, loop);
    }
  }

  stop(time) {}

  load(url) {
    url = url || this.props.url;
    return this.context.loadBuffer(url).then((buffer) => {
      this.$buffer = buffer;
      return this;
    });
  }
}

export default GranularSynth;
