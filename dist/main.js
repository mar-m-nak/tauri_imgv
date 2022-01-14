const InvokeErr = -1;

class RequestToRust {
  #invoke;
  constructor() {
    this.#invoke = window.__TAURI__.invoke;
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
}

class UserControl {
  #reqRust;
  #drives = [];
  #activeDriveNum = 0;
  constructor() {
    this.#reqRust = new RequestToRust();
    this.drives = [];
    this.#activeDriveNum = 0;
  }
  async init(payload) {
    this.#drives = payload.drives;
    document.querySelector('info').innerHTML = this.#drives;
    this.#activeDriveNum = await this.#reqRust.changeDrive(this.#activeDriveNum);
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
  const ctrl = new UserControl();
  ctrl.init(payload);
  // Hook key down
  document.addEventListener('keydown', (e) => {
    // Ignore IME inputting
    if (e.isComposing) {
      return;
    }
    switch (e.key) {
      case 'ArrowLeft':
        ctrl.selectDrive(-1);
        break;
      case 'ArrowRight':
        ctrl.selectDrive(1);
        break;
      default:
        break;
    }
  });
}
