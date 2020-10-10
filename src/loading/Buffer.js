const { default: Context } = require("../Context");

class Buffer {
  constructor(context, props = {}) {
    this.context = context;
    this.props = props;
  }
  async load(url = this.props.url) {
    this.props.url = url;
    this.$buffer = await this.context.loadBuffer(url);
    return;
  }
}

Context.registerComponent("Buffer", Buffer);
Context.loadBuffer = function (url) {
  return new Buffer(this, { url }).load();
};
