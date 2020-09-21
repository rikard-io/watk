/**
 * Copyright (c) 2020 Rikard Lindström
 *
 * @TODO long description for the file
 *
 * @summary @TODO short description for the file
 * @author Rikard Lindstrom <hi@rikard.io>
 */

let addCounter = 0;
const LINEAR_RAMP_TO_VALUE_AT_TIME = "LINEAR_RAMP_TO_VALUE_AT_TIME";
const SET_VALUE_AT_TIME = "SET_VALUE_AT_TIME";

function interpolateEvents(time, event1, event2) {
  if (event2.type === LINEAR_RAMP_TO_VALUE_AT_TIME) {
    const progress = (time - event1.time) / (event2.time - event1.time);
    const delta = event2.value - event1.value;
    return event1.value + delta * progress;
  } else {
    return event1.value;
  }
}

class Parameter {
  constructor(context, $parameter) {
    this.context = context;
    this.events = [];
    this.$parameter = $parameter;
  }

  _addEvent(event) {
    this.events.push(event);
    event.index = addCounter++;

    if (
      this.events.length &&
      event.time < this.events[this.events.length - 1].time
    ) {
      this.events.sort((a, b) =>
        a.time === b.time ? a.index - b.index : a.time - b.time
      );
    }
  }

  get loopDuration() {
    return this.loopEnd - this.loopStart;
  }

  setLoop(start, end) {
    this.loopStart = start;
    this.loopEnd = end;
    this.loop = true;
    return this;
  }

  setEnvelope(envelope) {
    const startTime = envelope[0][1];
    this.cancelScheduledValues(startTime);
    let lastValue = envelope[0][0];
    this.setValueAtTime(lastValue, envelope[0][1]);
    for (let i = 1; i < envelope.length; i++) {
      const value = envelope[i][0];
      const time = envelope[i][1];
      if (value !== lastValue) {
        this.linearRampToValueAtTime(value, time);
      } else {
        this.setValueAtTime(value, time);
      }
      lastValue = value;
    }
    return this;
  }

  setValue(value) {
    return this.setValueAtTime(value, this.context.currentTime);
  }

  setValueAtTime(value, time) {
    this._addEvent({
      time,
      value,
      type: SET_VALUE_AT_TIME,
    });
    if (this.$parameter) {
      this.$parameter.cancelScheduledValues(time);
      this.renderToWebAudioParameter(this.$parameter, time, time);
    }
    return this;
  }

  linearRampToValueAtTime(value, time) {
    this._addEvent({
      time,
      value,
      type: LINEAR_RAMP_TO_VALUE_AT_TIME,
    });
    if (this.$parameter) {
      this.$parameter.cancelScheduledValues(time);
      this.renderToWebAudioParameter(this.$parameter, time, time);
    }
    return this;
  }

  getValueAtTime(time) {
    if (!this.events.length) {
      return this.value;
    }
    if (this.events[this.events.length - 1].time <= time) {
      return this.events[this.events.length - 1].value;
    }
    let current, next;
    for (let i = 0; i < this.events.length; i++) {
      if (this.events[i].time > time) {
        next = i;
        break;
      }
      current = this.events[i];
    }
    if (current && next) {
      return interpolateEvents(time, current, next);
    } else {
      throw new Error("Unexpected");
    }
  }

  cancelScheduledValues(time) {
    this.events = this.events.filter((event) => event.time < time);
    if (this.$parameter) {
      this.$parameter.cancelScheduledValues(time);
    }
    return this;
  }

  cancelAndHoldAtTime(time) {
    if (this.events.length < 2) return this;
    let eventA, eventB;
    for (let i = 0; i < this.events.length; i++) {
      const event = this.events[i];
      if (event.time <= time) {
        eventA = event;
      } else {
        eventB = event;
        break;
      }
    }
    this.cancelScheduledValues(time);
    if (eventB) {
      if (eventB.type === LINEAR_RAMP_TO_VALUE_AT_TIME) {
        if (eventA) {
          this.linearRampToValueAtTime(
            interpolateEvents(time, eventA, eventB),
            time
          );
        } else {
          throw new Error(
            "linear ramp without a proceeding event not supported"
          );
        }
      } else if (eventA) {
        this.setValueAtTime(eventA.value, time);
      }
    } else if (eventA) {
      this.setValueAtTime(eventA.value, time);
    }
    return this;
  }

  renderToWebAudioParameter(
    waParameter,
    dspTime = 0,
    offsetTime = 0,
    duration = 9999
  ) {
    let frameOffset, frameDuration, endTime;

    if (this.loop) {
      if (offsetTime >= this.loopEnd) {
        frameOffset = this.loopStart + (offsetTime % this.loopDuration);
        frameDuration = this.loopEnd - frameOffset;
      } else {
        frameOffset = offsetTime % this.loopDuration;
        frameDuration = this.loopEnd - offsetTime;
      }
      frameDuration = Math.min(duration, frameDuration);
      endTime = Math.min(this.loopEnd, frameOffset + frameDuration);
    } else {
      frameOffset = offsetTime;
      frameDuration = duration;
      endTime = offsetTime + frameDuration;
    }

    if (frameDuration <= 0) {
      throw new Error("Frame duration should never be <= 0");
    }

    let leadingEvent = null;
    let prevEvent = null;
    this.events.forEach((event) => {
      if (event.time < frameOffset) {
        // store event before offsetTime
        //           oT       eT
        // ---event---|========|----->
        //
        leadingEvent = event;
        prevEvent = event;
      } else if (event.time >= endTime) {
        if (leadingEvent) {
          // handle event leading up to the first one for this render
          waParameter.setValueAtTime(
            interpolateEvents(frameOffset, leadingEvent, event),
            dspTime
          );
          leadingEvent = null;
        }

        // handle event after endTime
        //       oT       eT
        // ------|========|--event--->
        //
        if (prevEvent) {
          switch (event.type) {
            case SET_VALUE_AT_TIME:
              waParameter.setValueAtTime(
                prevEvent.value,
                dspTime + frameDuration
              );
              break;
            case LINEAR_RAMP_TO_VALUE_AT_TIME:
              waParameter.linearRampToValueAtTime(
                interpolateEvents(endTime, prevEvent, event),
                dspTime + frameDuration
              );
              break;
            default:
              throw new Error("Unsupported event type " + event.type);
          }
        }
      } else {
        const scheduleTime = dspTime + event.time - frameOffset;

        if (leadingEvent && scheduleTime !== dspTime) {
          // handle event leading up to the first one for this render
          waParameter.setValueAtTime(
            interpolateEvents(frameOffset, leadingEvent, event),
            dspTime
          );
        }
        leadingEvent = null;
        prevEvent = event;

        // handle event after endTime
        //       oT         eT
        // ------|==events==|----->
        //
        switch (event.type) {
          case SET_VALUE_AT_TIME:
            waParameter.setValueAtTime(event.value, scheduleTime);
            break;
          case LINEAR_RAMP_TO_VALUE_AT_TIME:
            waParameter.linearRampToValueAtTime(event.value, scheduleTime);
            break;
          default:
            throw new Error("Unsupported event type " + event.type);
        }
      }
    });

    if (leadingEvent) {
      // frameOffset was after all events
      waParameter.setValueAtTime(leadingEvent.value, dspTime);
    }

    if (this.loop) {
      const durationLeft = duration - frameDuration;
      if (durationLeft > 0) {
        this.renderToWebAudioParameter(
          waParameter,
          dspTime + frameDuration,
          frameOffset + frameDuration,
          durationLeft
        );
      }
    }
  }
}

export default Parameter;
