/**
 * Copyright (c) 2020 Rikard Lindström
 *
 * @TODO long description for the file
 *
 * @summary @TODO short description for the file
 * @author Rikard Lindstrom <hi@rikard.io>
 */

import AudioClipBuffered from "./playback/AudioClipBuffered";
import AudioClipStreaming from "./playback/AudioClipStreaming";
import Parameter from "./automation/Parameter";
import WebAudioFakePanner from "./processing/FakePanner";
import eventMixin from "./aux/eventMixin";

import BufferLoader from "./loading/BufferLoader";
import Scheduler from "./scheduling/Scheduler";

import generateUid from "./aux/generateUid";

const defaultOptions = {
  html5Only: false,
  webAudioContextOptions: { sampleRate: 44100, latencyHint: "playback" },
};

class Context {
  constructor(...args) {
    let options, waContext;
    const NativeContext = window.AudioContext || window.webkitAudioContext;
    if (args[0] instanceof NativeContext) {
      waContext = args[0];
      if (args[1]) {
        options = args[1];
      }
    } else {
      options = args[0];
    }
    const supportsWebAudio = !!NativeContext;

    this.options = Object.assign({}, defaultOptions, options);
    if (!this.options.html5Only && supportsWebAudio) {
      this.waContext =
        waContext || new NativeContext(this.options.webAudioContextOptions);

      if (
        this.waContext.sampleRate !==
        this.options.webAudioContextOptions.sampleRate
      ) {
        console.error(
          `Failed setting samplerate to ${this.options.webAudioContextOptions.sampleRate}, sampleRate currently at ${this.waContext.sampleRate}`
        );
      }
      this.$master = this.waContext.createGain();
      this.$master.connect(this.waContext.destination);
    }
    this.constructionTime = performance.now() * 0.001;
    this.registry = {};

    this.scheduler = new Scheduler(this);
    this.bufferLoader = new BufferLoader(this);
  }

  get webAudioEnabled() {
    return !!this.waContext;
  }

  get sampleRate() {
    if (this.waContext) {
      return this.waContext.sampleRate || 44100;
    } else {
      return 0;
    }
  }

  get currentTime() {
    if (this.waContext) {
      return this.waContext.currentTime;
    } else {
      return performance.now() * 0.001 - this.constructionTime;
    }
  }

  userInteraction() {
    if (this.webAudioEnabled && !this._userInitiated) {
      const ctx = this.waContext;
      if (typeof ctx.resume === "function") {
        ctx.resume();
      }
      const buffer = ctx.createBuffer(1, 2, 44100);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      setTimeout(() => {
        source.disconnect();
      }, 100);
      this.trigger("user-init");
      this._userInitiated = true;
    }
  }

  getObjectById(id) {
    if (!this.registry[id]) {
      throw new Error(`No object found with id ${id}`);
    }
    return this.registry[id];
  }

  async loadClip(urlOrProps) {
    const url = typeof urlOrProps === "string" ? urlOrProps : urlOrProps.url;
    if (!url)
      throw new Error(
        "Url need to be specified either as a string or a .url prop on a object"
      );

    const clip = this.createClip(
      typeof urlOrProps === "object" ? urlOrProps : { url }
    );

    await clip.load();
    return clip;
  }

  createClip(props) {
    let clip;
    if (this.webAudioEnabled) {
      clip = new (props && props.streaming
        ? AudioClipStreaming
        : AudioClipBuffered)(this, props);
    } else {
      throw new Error("not implemented");
    }
    if (this.registry[clip.id]) {
      throw new Error(`Clip already exists with id ${clip.id}`);
    }
    this.registry[clip.id] = clip;
    return clip;
  }

  createParameter(param) {
    return new Parameter(this, param);
  }

  createFakePanner(props) {
    return new WebAudioFakePanner(this, props);
  }

  load() {
    return Promise.all(
      Object.values(this.registry)
        .filter((o) => typeof o.load === "function")
        .map((o) => o.load())
    );
  }

  loadBuffer(url) {
    return this.bufferLoader.load(url);
  }

  scheduleCallback(time, callback) {
    return this.scheduler.scheduleCallback(time, callback);
  }

  scheduleRealtimeCallback(time, callback) {
    return this.scheduler.scheduleRealtimeCallback(time, callback);
  }

  cancelCallback(id) {
    return this.scheduler.cancelCallback(id);
  }

  cancelCallbacks(...ids) {
    return ids.map((id) => this.cancelCallback(id));
  }

  decodeAudioData(...args) {
    return this.waContext.decodeAudioData(...args);
  }
}

Context.registerComponent = function (name, ctor) {
  const createName = `create${name}`;
  if (Context.prototype[createName]) {
    throw new Error(`There\'s already a component named ${name}`);
  }
  Context.prototype[createName] = function (props = {}) {
    const component = new ctor(this, props);
    component.id = component.id || props.id || generateUid();
    if (this.registry[component.id]) {
      throw new Error(`Component with id ${component.id} already exists`);
    }
    this.registry[component.id] = component;
    return component;
  };
};
Object.assign(Context.prototype, eventMixin);

export default Context;
