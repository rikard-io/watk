export default async function (buffer, sampleRate, mono = false) {
  const OfflineAudioContext =
    window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (OfflineAudioContext) {
    const numSamples = Math.round(buffer.duration * sampleRate);
    let downsampleContext;
    let doSafaiFix = false;
    try {
      downsampleContext = new OfflineAudioContext(
        mono ? 1 : buffer.numberOfChannels,
        numSamples,
        sampleRate
      );
    } catch (e) {
      numSamples;
      downsampleContext = new OfflineAudioContext(
        mono ? 1 : buffer.numberOfChannels,
        Math.round(numSamples * (sampleRate / 44100)),
        44100
      );
      doSafaiFix = true;
    }
    const bufferSource = downsampleContext.createBufferSource();
    bufferSource.buffer = buffer;
    if (doSafaiFix) {
      bufferSource.playbackRate.value = 44100 / sampleRate;
    }
    bufferSource.connect(downsampleContext.destination);
    bufferSource.start(0);
    let promise = downsampleContext.startRendering();
    if (!(promise instanceof Promise)) {
      promise = new Promise((resolve, reject) => {
        downsampleContext.oncomplete = (e) => resolve(e.renderedBuffer);
        downsampleContext.onerror = reject;
      });
    }
    const downsampledBuffer = await promise;
    return downsampledBuffer;
  } else {
    return buffer;
  }
}
