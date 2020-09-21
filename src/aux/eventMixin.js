export default {
  trigger(eventName, ...args) {
    this.__eventListeners = this.__eventListeners || {};
    if (this.__eventListeners[eventName]) {
      this.__eventListeners[eventName].forEach((cb) => cb(...args));
    }
  },

  once(eventName, cb) {
    let onceWrapper = () => {
      this.off(eventName, onceWrapper);
      cb();
    };
    this.on(eventName, onceWrapper);
  },

  on(eventName, cb) {
    this.__eventListeners = this.__eventListeners || {};
    this.__eventListeners[eventName] = this.__eventListeners[eventName] || [];
    this.__eventListeners[eventName].push(cb);
  },

  off(eventName, cb) {
    if (this.__eventListeners && this.__eventListeners[eventName]) {
      this.__eventListeners[eventName] = this.__eventListeners[
        eventName
      ].filter((_cb) => _cb !== cb);
      if (!this.__eventListeners[eventName].length) {
        this.__eventListeners[eventName] = null;
      }
    }
  },
};
