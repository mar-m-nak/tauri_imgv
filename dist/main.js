const InvokeErr = -1;

class RequestToRust {
  #invoke;
  #subDirCount; // Number of subdirectories in the current entry list. (use it later.)
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
    const newDrvNum =
      await this.#invoke('change_drive', {
        chgNum: drvNum
      }).then((_newDrvNum) => {
        return _newDrvNum;
      }).catch(() => 0);
    return newDrvNum;
  }
  /**
   * Request directory scan
   * @returns {Array} Directory entries
   */
   async scanDir() {
    const dirs =
      await this.#invoke('scan_dir').then((_dirs) => {
        this.#invoke('count_sub_dir').then((_cnt) => {
          this.#subDirCount = _cnt;
        })
        return _dirs;
      }).catch(() => []);
    return dirs;
  }
  /**
   * Returns the number of subdirectories
   * @returns {number} Subdirectory count
   */
  get subDirCount() {
    return this.#subDirCount;
  }
}

class UserOperation {
  #reqRust;
  #drives = [];
  #activeDriveNum = 0; // Key of #drives
  #dirEntries = [];
  constructor() {
    this.#reqRust = new RequestToRust();
    this.#drives = [];
    this.#activeDriveNum = 0;
    this.#dirEntries = [];
  }
  async init(payload) {
    this.#drives = payload.drives;
    document.querySelector('info').innerHTML = this.#drives;
    this.#activeDriveNum = await this.#reqRust.changeDrive(this.#activeDriveNum);
    this.#dirEntries = await this.#reqRust.scanDir();
  }
  /**
   * Select drive
   * @param {number} inc increment (or decrement) current drive number
   */
  async selectDrive(inc) {
    let n = this.#activeDriveNum += parseInt(inc);
    let maxNum = this.#drives.length - 1;
    n = (n < 0) ? maxNum : n;
    n = (n > maxNum) ? 0 : n;
    this.#activeDriveNum = await this.#reqRust.changeDrive(n);
    console.log("Drv: " + this.#activeDriveNum);
    // Check the switching of the entry list
    document.querySelector('list').innerHTML = await this.#reqRust.scanDir();
  }
}

// Boot event ( from Rust .on_page_load() )
window.__TAURI__.event.listen('boot', async (ev) => {
  main(ev.payload);
});

/**
 * Main : key operation
 */
const main = (payload) => {
  const op = new UserOperation();
  op.init(payload);
  // Hook key down
  document.addEventListener('keydown', (e) => {
    // Ignore IME inputting
    if (e.isComposing) {
      return;
    }
    switch (e.key) {
      case 'ArrowLeft':
        op.selectDrive(-1);
        break;
      case 'ArrowRight':
        op.selectDrive(1);
        break;
      default:
        break;
    }
  });
}
