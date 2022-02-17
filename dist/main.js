const InvokeErr = -1;
const Img = new Image();
Img.addEventListener("error", () => {
  // Error : Suppress broken link icon.
  document.getElementById('img_preview').src = "";
}, false);
Img.addEventListener("load", () => {
  document.getElementById('img_preview').src = Img.src;
}, false);

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
   * Request directory change
   * @param {number} entryNum Request directory number
   * @returns {number} Changed directory number or InvokeErr
   */
  async changeDir(entryNum) {
    const newEntryNum =
      await this.#invoke('change_dir', {
        chgNum: entryNum
      }).then(() => {
        return entryNum;
      }).catch((e) => {
        console.log("ChangeDir Error: " + e);
        return InvokeErr;
      });
    return newEntryNum;
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
  #activeEntryNum = 0; // Key of #dirEntries
  constructor() {
    this.#reqRust = new RequestToRust();
  }
  async init(payload) {
    this.#drives = payload.drives;
    document.querySelector('info').innerHTML = this.#drives;
    this.#activeDriveNum = await this.#reqRust.changeDrive(this.#activeDriveNum);
    this.#dirEntries = await this.#reqRust.scanDir();
  }
  /**
   * Select entry item
   * @param {number} inc Increment (or decrement) current (file/dir) entry
   */
  selectEntry(inc) {
    let maxNum = this.#dirEntries.length - 1;
    let n = (inc == 0) ? 0 : this.#activeEntryNum + parseInt(inc);
    n = Math.max(n, 0);
    n = Math.min(n, maxNum);
    if (n != this.#activeEntryNum || n == 0) {
      // TODO: Make it a list view later
      let isDir = (n < this.#reqRust.subDirCount);
      let color = isDir ? "#FFAA00" : "#FFFFFF";
      let filename = this.#dirEntries[n];
      let item = n + " : " + filename;
      document.querySelector('list').innerHTML = '<font color="' + color + '">' + item + "</font>";
      // Images are requested by number n, cc is just for cache control.
      Img.src = 'https://reqimg./?n=' + n + "&cc=" + filename;
    }
    this.#activeEntryNum = n;
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
    this.#dirEntries = await this.#reqRust.scanDir();
    this.selectEntry(0);
  }
  /**
   * Enter the focused directory
   * @returns void
   */
  async enterDir() {
    let res = await this.#reqRust.changeDir(this.#activeEntryNum);
    if (res == InvokeErr) {
      return;
    }
    this.#activeEntryNum = 0;
    this.#dirEntries = await this.#reqRust.scanDir();
    this.selectEntry(0);
    // this.#lv.linkList(this.#dirEntries, this.#reqRust.subDirCount);
  }
  /**
   * Return to the parent directory in one shot
   */
  goBackParentDir() {
    this.selectEntry(0);
    this.#activeEntryNum = 0;
    this.enterDir();
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
      case 'ArrowUp':
        op.selectEntry(-1);
        break;
      case 'ArrowDown':
        op.selectEntry(1);
        break;
      case 'Enter':
        op.enterDir();
        e.preventDefault();
        break;
      case 'Backspace':
        op.goBackParentDir();
        e.preventDefault();
        break;
      default:
        break;
    }
  });
}
