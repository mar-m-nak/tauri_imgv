import * as CONST from "./constants.mjs";

class RequestToRust {
  #invoke;
  #subDirCount; // Number of subdirectories in the current entry list.
  constructor() {
    this.#invoke = window.__TAURI__.invoke;
    this.#subDirCount = 0;
  }
  /**
   * Request drive change
   * @param {number} drvNum Request drive number
   * @returns {number} Changed drive number
   */
  async changeDrive(drvNum) {
    return await this.#invoke('change_drive', { chgNum: drvNum })
      .then((_newDrvNum) => { return _newDrvNum })
      .catch(() => { return 0 })
  }
  /**
   * Request directory change
   * @param {number} entryNum Request directory number
   * @returns {number} Changed directory number or InvokeErr
   */
  async changeDir(entryNum) {
    return await this.#invoke('change_dir', { chgNum: entryNum })
      .then(() => { return entryNum })
      .catch((e) => {
        console.log("ChangeDir Error: " + e)
        return CONST.INVOKE_ERR;
      })
  }
  /**
   * Request directory scan
   * @returns {Array} Directory entries
   */
  async scanDir() {
    return await this.#invoke('scan_dir')
      .then(async (_dirs) => {
        await this.#invoke('count_sub_dir')
          .then((_cnt) => this.#subDirCount = _cnt)
          .catch(() => this.#subDirCount = 0)
        return _dirs;
      })
      .catch(() => { return [] })
  }
  /**
   * Returns the number of subdirectories
   * @returns {number} Subdirectory count
   */
  get subDirCount() {
    return this.#subDirCount;
  }
}

export { RequestToRust };
