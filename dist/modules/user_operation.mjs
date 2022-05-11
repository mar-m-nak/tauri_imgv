import * as CONST from "./constants.mjs";
import { RequestToRust } from './request_to_rust.mjs';
import { ListView } from './list_view.mjs';

class UserOperation {
  #reqRust;
  #drives = [];
  #activeDriveNum = 0; // Key of #drives
  #dirEntries = [];
  #activeEntryNum = 0; // Key of #dirEntries
  #lv;
  #img = new Image();
  constructor() {
    this.#reqRust = new RequestToRust();
    // Add Image event listener
    this.#img.addEventListener("error", () => {
      // Error : Suppress broken link icon.
      document.getElementById('img_preview').src = "";
    }, false);
    this.#img.addEventListener("load", () => {
      // Success : Disp into preview area
      document.getElementById('img_preview').src = this.#img.src;
    }, false);
  }
  async init(payload) {
    this.#drives = payload.drives;
    await this.#reqRust.changeDrive(this.#activeDriveNum)
      .then((_newDriveNum) => this.#activeDriveNum = _newDriveNum)
    await this.#reqRust.scanDir()
      .then((_newEntries) => this.#dirEntries = _newEntries)
    // Display drives and highlight the active drive
    this.#displayDrives();
    this.#HighlightActiveDrive();
    // Initialize the list view
    this.#lv = new ListView('#listview', 'tpl_listview');
    this.#lv.linkList(this.#dirEntries, this.#reqRust.subDirCount);
  }
  /**
   * Take list of drives and displays them in the HTML
   */
  #displayDrives() {
    let html = '';
    for (const d in this.#drives) {
      if (Object.hasOwnProperty.call(this.#drives, d)) {
        const letter = this.#drives[d].replace('\\', '');
        html = html + `<span id="drv${d}">${letter}</span>`;
      }
    }
    document.querySelector('#drives').innerHTML = html;
  }
  /**
   * Add "active" class to currently active drive
   */
  #HighlightActiveDrive() {
    for (const d in this.#drives) {
      document.getElementById(`drv${d}`).classList.remove('active');
    }
    document.getElementById(`drv${this.#activeDriveNum}`).classList.add('active');
  }
  /**
   * Select entry item
   * @param {number} inc Increment (or decrement) current (file/dir) entry
   */
  selectEntry(inc) {
    let maxNum = this.#dirEntries.length - 1;
    let n = (inc == 0) ? 0 : this.#activeEntryNum + parseInt(inc);
    n = (n < 0) ? 0 : n;
    n = (n > maxNum) ? maxNum : n;
    if (n != this.#activeEntryNum || n == 0) {
      let isDir = (n < this.#reqRust.subDirCount);
      let filename = this.#dirEntries[n];
      // Show information
      let item = `ENTRY: ${n} .. `;
      item = item + (isDir ? 'DIRECTORY' : 'FILE') + '<br>' + filename;
      document.querySelector('#select_path').innerHTML = item;
      // Select a row in the list view
      this.#lv.selectRow(n, this.#activeEntryNum);
      // Images are requested by number n, cc is just for cache control.
      this.#img.src = `https://reqimg./?n=${n}&cc=${filename}`;
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
    await this.#reqRust.changeDrive(n)
      .then((_newDriveNum) => this.#activeDriveNum = _newDriveNum);
    await this.#reqRust.scanDir()
      .then((_newEntries) => this.#dirEntries = _newEntries);
    this.#HighlightActiveDrive();
    this.selectEntry(0);
    this.#lv.linkList(this.#dirEntries, this.#reqRust.subDirCount);
  }
  /**
   * Enter the focused directory
   * @returns void
   */
  async enterDir() {
    let res = await this.#reqRust.changeDir(this.#activeEntryNum);
    if (res == CONST.INVOKE_ERR) {
      return;
    }
    this.#activeEntryNum = 0;
    this.#dirEntries = await this.#reqRust.scanDir();
    this.selectEntry(0);
    this.#lv.linkList(this.#dirEntries, this.#reqRust.subDirCount);
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

export { UserOperation };
