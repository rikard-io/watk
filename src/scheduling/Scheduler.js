/**
 * Copyright (c) 2020 Rikard Lindström
 *
 * @summary Scheduler for scheduling events with some margin for webaudio scheduling
 * @author Rikard Lindstrom <hi@rikard.io>
 */

const defaultProps = {
  lookAHead: 0.2,
};

let callbackIdCounter = 101;

class Scheduler {
  constructor(context, props) {
    this.context = context;
    this.props = Object.assign({}, defaultProps, props);
    this.isRunning = false;
    this.events = [];
    this._realtimeCallbacks = [];
    this._runningRealtimeLoop = false;
    this.currentSchedulingTime = 0;
  }

  _runRealtimeCallback(event) {
    this._realtimeCallbacks.push(event);
    this._realtimeCallbacks.sort((a, b) => a.time - b.time);
    if (!this._runningRealtimeLoop) {
      const loop = () => {
        const time = this.context.currentTime + 1 / 60;
        while (this._realtimeCallbacks.length) {
          const event = this._realtimeCallbacks[0];
          if (event.time <= time) {
            // order very important here, since callback can create a new event
            this._realtimeCallbacks.splice(0, 1);
            event.callback(event.time);
          } else {
            break;
          }
        }
        if (this._realtimeCallbacks.length > 0) {
          requestAnimationFrame(loop);
        } else {
          this._runningRealtimeLoop = false;
        }
      };
      this._runningRealtimeLoop = true;
      loop();
    }
  }

  run() {
    if (this.isRunning) {
      throw new Error("Scheduler already running");
    }
    this.isRunning = true;
    const loop = () => {
      const time = this.context.currentTime;
      const scheduleTime = time + this.props.lookAHead;
      while (this.events.length) {
        if (this.events[0].time <= scheduleTime) {
          const event = this.events.shift();
          if (event.realtime) {
            this._runRealtimeCallback(event);
          } else {
            event.callback(event.time);
          }
        } else {
          break;
        }
      }
      this.currentSchedulingTime = scheduleTime;
      if (!this.events.length) {
        this.isRunning = false;
      }
      if (this.isRunning) {
        setTimeout(loop, this.props.lookAHead * 500);
      }
    };

    setTimeout(loop, this.props.lookAHead * 500);
  }

  scheduleCallback(time, callback, realtime = false) {
    if (!isFinite(time)) {
      throw new Error("Time is not finite");
    }
    let id = callbackIdCounter++;
    this.events.push({
      id,
      time,
      callback,
      realtime,
    });
    this.events.sort((a, b) => a.time - b.time);

    if (!this.isRunning) {
      this.run();
    }
    return id;
  }

  scheduleRealtimeCallback(time, callback) {
    if (time <= this.context.currentTime) {
      callback(time);
      return -1;
    } else if (time <= this.currentSchedulingTime) {
      this._runRealtimeCallback({ time, callback, realtime: true });
    } else {
      return this.scheduleCallback(time, callback, true);
    }
  }

  cancelCallback(id) {
    this.events = this.events.filter((evnt) => evnt.id !== id);
    this._realtimeCallbacks = this._realtimeCallbacks.filter((evnt) => evnt.id !== id);
  }
}

export default Scheduler;
