class FakePanner {
  constructor(waContext) {
    this.$gainLeft = waContext.createGain();
    this.$gainRight = waContext.createGain();
    this.$output = waContext.createChannelMerger(2);
    this.$input = waContext.createChannelSplitter(2);
    this.$gainLeft.connect(this.$output, 0, 0);
    this.$gainRight.connect(this.$output, 0, 1);
    this.$input.connect(this.$gainLeft, 0, 0);
    this.$input.connect(this.$gainRight, 1, 0);
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

  connect(dest, output, input) {
    this.$output.connect(dest.$input || dest, output, input);
  }

  disconnect(dest) {
    this.$output.disconnect(dest.$input || dest);
  }

  setValueAtTime(value, time) {
    const [l, r] = this.remapLrValue(value);
    this.$gainLeft.gain.setValueAtTime(l, time);
    this.$gainRight.gain.setValueAtTime(r, time);
  }

  cancelScheduledValues(time) {
    this.$gainLeft.gain.cancelScheduledValues(time);
    this.$gainRight.gain.cancelScheduledValues(time);
  }

  linearRampToValueAtTime(value, time) {
    const [l, r] = this.remapLrValue(value);
    this.$gainLeft.gain.linearRampToValueAtTime(l, time);
    this.$gainRight.gain.linearRampToValueAtTime(r, time);
  }

  exponentialRampToValueAtTime(value, time) {
    const [l, r] = this.remapLrValue(value);
    this.$gainLeft.gain.exponentialRampToValueAtTime(l, time);
    this.$gainRight.gain.exponentialRampToValueAtTime(r, time);
  }

  smoothSetPan(pan, time) {
    const [l, r] = this.remapLrValue(pan);
    this.$gainLeft.gain.setTargetAtTime(l, time, 0.05);
    this.$gainRight.gain.setTargetAtTime(r, time, 0.05);
  }
}

export default FakePanner;
