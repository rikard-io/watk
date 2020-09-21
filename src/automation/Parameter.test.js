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
  clear() {
    this.capturedEvents = [];
  }
}

describe("Parameter", () => {
  describe(".setValueAtTime", () => {
    test("event count", () => {
      const param = new Parameter({});
      expect(param.events.length).toEqual(0);
      param.setValueAtTime(1, 0.5);
      expect(param.events.length).toEqual(1);
    });
  });

  describe(".getValueAtTime", () => {
    test("interpolation", () => {
      const param = new Parameter({});
      param.setValueAtTime(1, 0.5);
      param.linearRampToValueAtTime(0, 1.5);
      expect(param.getValueAtTime(1)).toEqual(1);
    });
  });

  describe(".cancelAndHoldValues", () => {
    let param;

    beforeEach(() => {
      param = new Parameter({});
    });

    test("Simple linear ramp, cancelled half way through", () => {
      param.setValueAtTime(0, 0);
      param.linearRampToValueAtTime(1, 1);
      param.cancelAndHoldAtTime(0.5);

      expect(param.events.length).toEqual(2);
      // let mockParam = new MockWebAudioParam();

      expect(simplifyEvent(param.events[1])).toEqual({
        time: 0.5,
        value: 0.5,
      });
    });

    test("Fade interuption", () => {
      const startTime = 100.18374782394;
      const mockParam = new MockWebAudioParam();
      const fadeTime = 4;
      // Fade-in
      param.setValueAtTime(0, startTime);
      param.linearRampToValueAtTime(1, startTime + fadeTime);

      // Fade out
      param.cancelAndHoldAtTime(startTime + fadeTime * 0.5);
      param.linearRampToValueAtTime(0, startTime + fadeTime);

      expect(param.events.length).toEqual(3);
      expect(simplifyEvent(param.events[0])).toEqual({
        time: startTime,
        value: 0,
      });
      expect(simplifyEvent(param.events[1])).toEqual({
        time: startTime + 2,
        value: 0.5,
      });
      expect(simplifyEvent(param.events[2])).toEqual({
        time: startTime + fadeTime,
        value: 0,
      });
      param.renderToWebAudioParameter(
        mockParam,
        startTime,
        startTime,
        fadeTime
      );
      expect(mockParam.capturedEvents.length).toEqual(3);

      expect(mockParam.capturedEvents[0]).toEqual({
        time: startTime,
        value: 0,
        type: "SET",
      });
      expect(mockParam.capturedEvents[1]).toEqual({
        time: startTime + 2,
        value: 0.5,
        type: "LINEAR_RAMP",
      });
      expect(mockParam.capturedEvents[2]).toEqual({
        time: startTime + fadeTime,
        value: 0,
        type: "LINEAR_RAMP",
      });
    });
  });

  describe(".renderToWebAudioParameter", () => {
    let param;
    let mockParam;

    beforeEach(() => {
      param = new Parameter({});
      mockParam = new MockWebAudioParam();
    });

    describe("non-looping", () => {
      test("all events within render frame", () => {
        param.setValueAtTime(1, 0.5);
        param.linearRampToValueAtTime(0, 2.3333);
        param.renderToWebAudioParameter(mockParam, 0, 0, 4);

        expect(mockParam.capturedEvents[0]).toEqual({
          time: 0.5,
          value: 1,
          type: "SET",
        });
        expect(mockParam.capturedEvents[1]).toEqual({
          time: 2.3333,
          value: 0,
          type: "LINEAR_RAMP",
        });
      });

      test("leading ramp", () => {
        param.setValueAtTime(0, 0);
        param.linearRampToValueAtTime(3, 3);
        param.renderToWebAudioParameter(mockParam, 0, 2, 2);
        expect(mockParam.capturedEvents.length).toEqual(2);
        expect(mockParam.capturedEvents[0]).toEqual({
          time: 0,
          value: 2,
          type: "SET",
        });
        expect(mockParam.capturedEvents[1]).toEqual({
          time: 1,
          value: 3,
          type: "LINEAR_RAMP",
        });
      });

      test("trailing ramp", () => {
        param.setValueAtTime(0, 0);
        param.linearRampToValueAtTime(3, 3);
        param.renderToWebAudioParameter(mockParam, 0, 0, 2);
        expect(mockParam.capturedEvents.length).toEqual(2);
        expect(mockParam.capturedEvents[0]).toEqual({
          time: 0,
          value: 0,
          type: "SET",
        });
        expect(mockParam.capturedEvents[1]).toEqual({
          time: 2,
          value: 2,
          type: "LINEAR_RAMP",
        });
      });

      test("leading trailing ramp", () => {
        param.setValueAtTime(0, 0);
        param.linearRampToValueAtTime(4, 4);
        param.renderToWebAudioParameter(mockParam, 0, 1, 2);

        expect(mockParam.capturedEvents.length).toEqual(2);
        expect(mockParam.capturedEvents[0]).toEqual({
          time: 0,
          value: 1,
          type: "SET",
        });
        expect(mockParam.capturedEvents[1]).toEqual({
          time: 2,
          value: 3,
          type: "LINEAR_RAMP",
        });
      });
    });

    describe("looping", () => {
      test("all events within render frame", () => {
        param.setValueAtTime(0, 0);
        param.linearRampToValueAtTime(1, 1);
        param.setLoop(0, 4);
        param.renderToWebAudioParameter(mockParam, 0, 0, 8);
        expect(mockParam.capturedEvents.length).toEqual(4);

        expect(mockParam.capturedEvents[0]).toEqual({
          time: 0,
          value: 0,
          type: "SET",
        });
        expect(mockParam.capturedEvents[1]).toEqual({
          time: 1,
          value: 1,
          type: "LINEAR_RAMP",
        });
        expect(mockParam.capturedEvents[2]).toEqual({
          time: 4,
          value: 0,
          type: "SET",
        });
        expect(mockParam.capturedEvents[3]).toEqual({
          time: 5,
          value: 1,
          type: "LINEAR_RAMP",
        });
      });

      test("all events within render frame - edge case", () => {
        param.setValueAtTime(0, 0);
        param.linearRampToValueAtTime(1, 4);
        param.setLoop(0, 4);
        const offsetTime = 0.1;
        param.renderToWebAudioParameter(mockParam, offsetTime, 0, 8);
        expect(mockParam.capturedEvents.length).toEqual(4);

        expect(mockParam.capturedEvents[0]).toEqual({
          time: offsetTime + 0,
          value: 0,
          type: "SET",
        });
        expect(mockParam.capturedEvents[1]).toEqual({
          time: offsetTime + 4,
          value: 1,
          type: "LINEAR_RAMP",
        });
        expect(mockParam.capturedEvents[2]).toEqual({
          time: offsetTime + 4,
          value: 0,
          type: "SET",
        });
        expect(mockParam.capturedEvents[3]).toEqual({
          time: offsetTime + 8,
          value: 1,
          type: "LINEAR_RAMP",
        });
      });

      test("loop start offset", () => {
        param.setValueAtTime(0, 0);
        param.linearRampToValueAtTime(1, 4);
        param.linearRampToValueAtTime(0, 5);
        param.linearRampToValueAtTime(1, 6);
        param.linearRampToValueAtTime(0, 7);

        param.setLoop(4, 8);
        param.renderToWebAudioParameter(mockParam, 0, 0, 12);

        expect(mockParam.capturedEvents.length).toEqual(9);
        expect(mockParam.capturedEvents[0]).toEqual({
          time: 0,
          value: 0,
          type: "SET",
        });
        expect(mockParam.capturedEvents[1]).toEqual({
          time: 4,
          value: 1,
          type: "LINEAR_RAMP",
        });
        expect(mockParam.capturedEvents[2]).toEqual({
          time: 5,
          value: 0,
          type: "LINEAR_RAMP",
        });

        expect(mockParam.capturedEvents[7]).toEqual({
          time: 10,
          value: 1,
          type: "LINEAR_RAMP",
        });
      });

      test("Rounding errors", () => {
        const bts = 60 / 105;

        param.setEnvelope([
          [0, 0],
          [1, 1],
          [0, 2],
          [1, 3],
        ]);
        param.setLoop(0, 4);
        const loopDur = bts * 4;

        for (let i = 0; i < 20; i++) {
          mockParam.clear();
          param.renderToWebAudioParameter(mockParam, i, loopDur * i, loopDur);
          expect(mockParam.capturedEvents[0].time).toEqual(i);
        }
      });
    });
  });
});
