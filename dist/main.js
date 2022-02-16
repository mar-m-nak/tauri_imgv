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
  #lastRequestNum = -1;
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
    let oldNum = this.#activeEntryNum;
    let n = this.#activeEntryNum += parseInt(inc);
    let maxNum = this.#dirEntries.length - 1;
    n = (n < 0) ? 0 : n;
    n = (n > maxNum) ? maxNum : n;
    this.#activeEntryNum = (inc == 0) ? 0 : n;
    if (this.#activeEntryNum != oldNum || inc == 0) {
      // TODO: Make it a list view later
      let isDir = (this.#activeEntryNum < this.#reqRust.subDirCount);
      let color = isDir ? "#FFAA00" : "#FFFFFF";
      let filename = this.#dirEntries[this.#activeEntryNum];
      let item = this.#activeEntryNum + " : " + filename;
      document.querySelector('list').innerHTML = '<font color="' + color + '">' + item + "</font>";
      // Start image request
      let img = new Image();
      img.addEventListener("error", () => {
        // Error : Suppress broken link icons
        document.getElementById('img_preview').src = "";
      }, false);
      img.addEventListener("load", (ev) => {
        // Success : Image switching
        // Display when the last request number and the response URL number match.
        let resUri = new URL(ev.path[0].currentSrc);
        let resNum = resUri.searchParams.get('n');
        if (this.#lastRequestNum == resNum) {
          document.getElementById('img_preview').src = img.src;
        }
      }, false);
      // Images are requested by n number, cc is just for cache control.
      this.#lastRequestNum = n;
      img.src = 'https://reqimg./?n=' + n + "&cc=" + filename;
    }
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
