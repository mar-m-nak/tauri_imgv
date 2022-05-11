class ListView {
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

export { ListView };
