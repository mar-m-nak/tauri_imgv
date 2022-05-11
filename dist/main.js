import { UserOperation } from './modules/user_operation.mjs';

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
