#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use serde::Serialize;
use std::{
  path::{Path, PathBuf},
  sync::Mutex,
};

use tauri::{api::dir::is_dir, State};

#[derive(Serialize)]
struct BootPayload {
  drives: Vec<String>
}

#[derive(Debug)]
struct DriveEntries(Mutex<Vec<String>>);
struct ActiveDrive(Mutex<usize>);
struct ActivePath(Mutex<PathBuf>);

#[tauri::command]
fn change_drive(
  chg_num: usize,
  active_drive: State<ActiveDrive>,
  drives: State<DriveEntries>,
  active_path: State<ActivePath>,
) -> usize {
  let v_drives = drives.0.lock().unwrap().to_vec();
  let new_num = if let Some(_letter) = v_drives.get(chg_num) {
    chg_num
  } else {
    0
  };
  *active_drive.0.lock().unwrap() = new_num;
  *active_path.0.lock().unwrap() = Path::new(dbg!(&v_drives[new_num])).to_path_buf();
  new_num
}

fn main() {
  tauri::Builder::default()
  .manage(DriveEntries(scan_drive().into()))
  .manage(ActiveDrive(0.into()))
  .manage(ActivePath(Default::default()))
  .invoke_handler(tauri::generate_handler![
      change_drive,
      // scan_dir,
      // change_dir,
      // get_sub_dir_count,
    ])
    .on_page_load(|window, _payload| {
      let payload = BootPayload { drives: scan_drive() };
      window
        .emit("boot", Some(payload))
        .expect("failed to emit event");
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}

fn scan_drive() -> Vec<String> {
  let mut drives: Vec<String> = Vec::new();
  for a in 0..26 + b'A' {
    let d = format!("{}:\\", a as char);
    if let Ok(_) = is_dir(&d) {
      drives.push(d);
    };
  }
  drives
}
