function wrapDebug(id, param, context) {
  const orgSet = param.setValueAtTime;
  const orgSetTarget = param.setTargetAtTime;
  const orgRamp = param.linearRampToValueAtTime;
  const orgClear = param.cancelScheduledValues;

  param.cancelScheduledValues = function (time) {
    console.log(
      `${id}.cancelScheduledValues(${time})`,
      time - context.currentTime
    );
    orgClear.call(param, time);
  };

  param.setValueAtTime = function (value, time) {
    console.log(
      `${id}.setValueAtTime(${value}, ${time})`,
      time - context.currentTime
    );
    orgSet.call(param, value, time);
  };

  param.setTargetAtTime = function (value, time, timeConstant) {
    console.log(
      `${id}.setTargetAtTime(${value}, ${time}, ${timeConstant})`,
      time - context.currentTime
    );
    orgSetTarget.call(param, value, time, timeConstant);
  };

  param.linearRampToValueAtTime = function (value, time) {
    console.log(
      `${id}.linearRampToValueAtTime(${value}, ${time})`,
      time - context.currentTime
    );
    orgRamp.call(param, value, time);
  };
}

export default wrapDebug;
