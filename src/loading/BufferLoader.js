const bufferCache = {};

class BufferLoader {
  constructor(context) {
    this.context = context;
  }

  load(url) {
    if (bufferCache[url]) {
      if (bufferCache[url] instanceof Promise) {
        return bufferCache[url];
      }
      return Promise.resolve(bufferCache[url]);
    }
    const promise = new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("GET", url, true);
      request.responseType = "arraybuffer";

      request.onload = () => {
        this.context.decodeAudioData(
          request.response,
          (buffer) => {
            bufferCache[url] = buffer;
            resolve(buffer);
          },
          reject
        );
      };

      request.send();
    });

    bufferCache[url] = promise;
    return promise;
  }

  getBuffer(url) {
    return bufferCache[url];
  }
}

BufferLoader.clearCache = function () {
  bufferCache = {};
};

export default BufferLoader;
