export function createStereoPanner(context) {
  let panner;
  if (context.createStereoPanner) {
    panner = context.createPanner();
    panner.smoothSetPan = function (pan, time) {
      panner.setTargetAtTime(pan, time, 0.05);
    };
  } else {
    const panner = context.createPanner();
    panner.panningModel = "equalpower";
    panner.smoothSetPan = function (pan, time) {
      const zPos = 1 - Math.abs(pan);
      if (panner.positionX) {
        panner.positionX.setTargetAtTime(xPos, time, 0.05);
        panner.positionZ.setTargetAtTime(zPos, time, 0.05);
      } else {
        panner.setPosition(pan, 0, zPos);
      }
    };
  }
  return panner;
}
