const bufferCache = {};

class BufferLoader {
  constructor(context) {
    this.context = context;
  }

  loadArrayBuffer(id, arraybuffer) {
    // if (bufferCache[id]) {
    //   if (bufferCache[id] instanceof Promise) {
    //     return bufferCache[id];
    //   }
    //   return Promise.resolve(bufferCache[id]);
    // }
    return new Promise((resolve, reject) => {
      this.context.decodeAudioData(
        arraybuffer,
        (buffer) => {
          bufferCache[id] = buffer;
          resolve(buffer);
        },
        reject
      );
    });
  }

  load(url, id = url) {
    if (bufferCache[id]) {
      if (bufferCache[id] instanceof Promise) {
        return bufferCache[id];
      }
      return Promise.resolve(bufferCache[id]);
    }
    const promise = new Promise((resolve, reject) => {
      const request = new XMLHttpRequest();
      request.open("GET", url, true);
      request.responseType = "arraybuffer";
      request.onload = async () => {
        try {
          const buffer = await this.loadArrayBuffer(id, request.response);
          resolve(buffer);
        } catch (err) {
          reject(err);
        }
      };

      request.send();
    });

    bufferCache[id] = promise;
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
