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
    return await this.#invoke('change_drive', {chgNum: drvNum})
      .then((_newDrvNum) => {return _newDrvNum})
      .catch(() => {return 0})
  }
  /**
   * Request directory change
   * @param {number} entryNum Request directory number
   * @returns {number} Changed directory number or InvokeErr
   */
  async changeDir(entryNum) {
    return await this.#invoke('change_dir', {chgNum: entryNum})
      .then(() => {return entryNum})
      .catch((e) => {
        console.log("ChangeDir Error: " + e)
        return InvokeErr
      })
  }
  /**
   * Request directory scan
   * @returns {Array} Directory entries
   */
  async scanDir() {
    return await this.#invoke('scan_dir')
      .then(async (_dirs) => {await this.#invoke('count_sub_dir')
        .then((_cnt) => this.#subDirCount = _cnt)
        .catch(() => this.#subDirCount = 0)
        return _dirs;
      })
      .catch(() => {return []})
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
  #lv;
  constructor() {
    this.#reqRust = new RequestToRust();
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
    this.#lv = new listview('#listview', 'tpl_listview');
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
      item = item + (isDir ? 'DIRECTORY': 'FILE') + '<br>' + filename;
      document.querySelector('#select_path').innerHTML = item;
      // Select a row in the list view
      this.#lv.selectRow(n, this.#activeEntryNum);
      // Images are requested by number n, cc is just for cache control.
      Img.src = `https://reqimg./?n=${n}&cc=${filename}`;
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
    if (res == InvokeErr) {
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

class listview {
  #baseElement; // '#listview';
  #list; // array
  #rowTemplate; // '#template_id'
  #lvHeight;
  #rowHeight;
  /**
   * Constructor
   * @param {string} baseElement ID name of list view generation destination
   * @param {string} rowTemplate ID name of row template
   */
  constructor(baseElement, rowTemplate) {
    this.#baseElement = baseElement;
    this.#rowTemplate = rowTemplate;
    // Size setting
    this.#rowHeight = 0;
    this.updateSizeValue();
    window.addEventListener('resize', () => { // Updated when resizing
      this.updateSizeValue();
    }, true);
  }
  /**
   * Size update
   */
  updateSizeValue() {
    this.#lvHeight = document.querySelector(this.#baseElement).offsetHeight;
  }
  /**
   * Link the list
   * @param {Object} list List contents
   * @param {number} dirCount Number of subdirectories in the entry
   */
  linkList(list, dirCount) {
    this.#list = list;
    this.#drawAllRow(dirCount);
    this.selectRow(0, 0);
  }
  /**
   * Append all rows
   * @param {number} dirCount Number of subdirectories in the entry
   */
  #drawAllRow(dirCount) {
    const base = document.querySelector(this.#baseElement);
    const tpl = document.getElementById(this.#rowTemplate);
    const t = performance.now();
    base.textContent = '';
    for (const entryNum in this.#list) {
      // Row node cloning
      const row = tpl.firstElementChild.cloneNode(true);
      row.id = 'row_id' + entryNum;
      // Set the text of the node and add it to the base element
      row.textContent = this.#getEntryName(entryNum);
      base.appendChild(row);
      // Apply styles for directories
      if (entryNum < dirCount) row.classList.add('is_dir');
      // Align the height of all rows to the height of the first row
      if (entryNum == 0)  this.#rowHeight = row.clientHeight;
      row.style.height = this.#rowHeight + 'px';
    }
    console.log("Draw all rows ... " + (performance.now() - t) + 'ms');
  }
  /**
   * Returns the entry name (directory, file)
   * @param {number} entryNum Entry number
   * @returns Entry name
   */
  #getEntryName(entryNum) {
    let entry = this.#list[entryNum];
    if (entryNum == 0) {
      // The first entry will be / or ../
      let ne = this.#list[1];
      entry = (ne && (ne.match(/\\|\//g)||[]).length == 1) ? '/' : '../';
    } else {
      // Cut out the filename body from the path
      let p = entry.lastIndexOf('\\');
      p = p < 0 ? entry.lastIndexOf('/') : p;
      entry = p < 0 ? entry : entry.slice(p + 1);
    }
    return entry;
  }
  /**
   * Select a row
   * @param {number} entryNum Entry number to select
   * @param {number} oldNum Previously selected entry number
   */
  selectRow(entryNum, oldNum) {
    document.getElementById('row_id' + oldNum).classList.remove('active');
    document.getElementById('row_id' + entryNum).classList.add('active');
    this.scrollToVisible(entryNum, oldNum);
  }
  /**
   * Scroll to the position where you can see the selected line
   * @param {number} entryNum Entry number
   * @param {number} oldNum Previously selected entry number
   * @returns void
   */
  scrollToVisible(entryNum) {
    let invisible = this.checkRowScrollOut(entryNum);
    if (invisible == 0) return;
    document.getElementById('row_id' + entryNum).scrollIntoView(invisible < 0);
  }
  /**
   * Investigate whether the selected row has scrolled out
   * @param {number} entryNum Entry number
   * @returns {number} 0 = appear, -1 or 1 Above or below the list view range
   */
   checkRowScrollOut(entryNum) {
    let rowTop = entryNum * this.#rowHeight;
    let areaTop = document.getElementById('listview').scrollTop;
    let areaBottom = areaTop + this.#lvHeight - 1;
    return areaTop > rowTop ? -1 : areaBottom < rowTop ? 1 : 0;
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
        break;
      case 'Backspace':
        op.goBackParentDir();
        break;
      default:
        return;
    }
    e.preventDefault();
  });
}
