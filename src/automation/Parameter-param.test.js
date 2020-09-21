/**
 * Copyright (c) 2020 Rikard Lindström
 *
 * @TODO long description for the file
 *
 * @summary @TODO short description for the file
 * @author Rikard Lindstrom <hi@rikard.io>
 */

import Parameter from "./Parameter";

function simplifyEvent(event) {
  const { time, value } = event;
  return { time, value };
}

class MockWebAudioParam {
  constructor() {
    this.clear();
  }
  setValueAtTime(value, time) {
    this.capturedEvents.push({ value, time, type: "SET" });
  }
  linearRampToValueAtTime(value, time) {
    this.capturedEvents.push({ value, time, type: "LINEAR_RAMP" });
  }
  cancelScheduledValues(value, time) {
    this.capturedEvents.push({ value, time, type: "CANCEL" });
  }
  clear() {
    this.capturedEvents = [];
  }
}

describe("Parameter wrapping WebAudioParameter", () => {
  describe(".setValueAtTime", () => {
    test("it should schedule replicate scheduling on native audio param", () => {
      const mockParam = new MockWebAudioParam();
      const param = new Parameter({}, mockParam);
      param.setValueAtTime(0.123, 4);
      expect(mockParam.capturedEvents[1]).toEqual({
        time: 4,
        value: 0.123,
        type: "SET",
      });
    });
  });
});
