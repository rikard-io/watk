/**
 * Copyright (c) 2020 Rikard Lindström
 *
 *  A simple stereo panning implementaton based on gain nodes and channel mergers / splitters
 *  Might not cover all use-cases but works better then the 3D panner polyfill I've seen all over – which creates noises in Safari
 *
 *  To use as a polyfill: import module and call .polyfill()
 *
 * @summary A stereo panning implementaton based on gain nodes and channel mergers / splitters
 * @author Rikard Lindstrom <hi@rikard.io>
 */

class PanParameter {
  constructor(owner) {
    this.owner = owner;
    this.value = 0;
  }

  remapLrValue(pan) {
    let l, r;
    if (pan > 0) {
      l = 1 - pan;
      r = 1;
    } else {
      l = 1;
      r = 1 + pan;
    }
    return [l, r];
  }

  setValueAtTime(value, time) {
    const [l, r] = this.remapLrValue(value);
    this.owner.$gainLeft.gain.setValueAtTime(l, time);
    this.owner.$gainRight.gain.setValueAtTime(r, time);
  }

  cancelScheduledValues(time) {
    this.owner.$gainLeft.gain.cancelScheduledValues(time);
    this.owner.$gainRight.gain.cancelScheduledValues(time);
  }

  setTargetAtTime(value, time, timeConstant) {
    const [l, r] = this.remapLrValue(value);
    this.owner.$gainLeft.gain.setTargetTime(l, time, timeConstant);
    this.owner.$gainRight.gain.setTargetTime(r, time, timeConstant);
  }

  linearRampToValueAtTime(value, time) {
    const [l, r] = this.remapLrValue(value);
    this.owner.$gainLeft.gain.linearRampToValueAtTime(l, time);
    this.owner.$gainRight.gain.linearRampToValueAtTime(r, time);
  }

  exponentialRampToValueAtTime(value, time) {
    const [l, r] = this.remapLrValue(value);
    this.owner.$gainLeft.gain.exponentialRampToValueAtTime(l, time);
    this.owner.$gainRight.gain.exponentialRampToValueAtTime(r, time);
  }
}

class StereoPanner {
  constructor(waContext) {
    this.$gainLeft = waContext.createGain();
    this.$gainRight = waContext.createGain();
    this.$output = waContext.createChannelMerger(2);
    this.$input = waContext.createChannelSplitter(2);
    this.$gainLeft.connect(this.$output, 0, 0);
    this.$gainRight.connect(this.$output, 0, 1);
    this.$input.connect(this.$gainLeft, 0, 0);
    this.$input.connect(this.$gainRight, 1, 0);
    this.pan = new PanParameter(this);
  }

  connect(dest, output, input) {
    this.$output.connect(dest.$input || dest, output, input);
  }

  disconnect(dest) {
    this.$output.disconnect((dest && dest.$input) || dest);
  }
}

export default StereoPanner;

StereoPanner.polyfill = function () {
  const Context = window.AudioContext || window.webkitAudioContext;
  if (Context) {
    if (!Context.prototype.createStereoPanner) {
      Context.prototype.createStereoPanner = function () {
        return new StereoPanner(this);
      };
    }
  }
};
