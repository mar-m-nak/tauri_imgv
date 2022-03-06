#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use serde::Serialize;
use std::fs::{self, read};
use std::{
  path::{Path, PathBuf},
  sync::Mutex,
};

use tauri::{api::dir::is_dir, State};
use tauri::http::ResponseBuilder;
use tauri::Manager;

#[derive(Serialize)]
struct BootPayload {
  drives: Vec<String>
}

const CHANGE_DIR_ERROR: i8 = -1;
const CHANGE_DIR_WARNING: i8 = -2;

#[derive(Debug)]
struct DriveEntries(Mutex<Vec<String>>);
struct ActiveDrive(Mutex<usize>);
struct ActivePath(Mutex<PathBuf>);
struct DirEntries(Mutex<Vec<PathBuf>>);
struct SubDirectoriesCount(Mutex<usize>); // Number of subdirectories in the current entry list.

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

#[tauri::command]
fn change_dir(
  chg_num: usize,
  dir_entries: State<DirEntries>,
  active_path: State<ActivePath>,
) -> Result<(), i8> {
  let v_dirs = &*dir_entries.0.lock().unwrap();
  let target_dir = if let Some(_dir) = v_dirs.get(chg_num) {
    &v_dirs[chg_num]
  } else {
    return Err(CHANGE_DIR_ERROR); // Number is out of range of v_dirs
  };
  if !target_dir.is_dir() {
    return Err(CHANGE_DIR_WARNING); // Not a directory
  }
  *active_path.0.lock().unwrap() = target_dir.to_path_buf();
  Ok(())
}

#[tauri::command]
fn scan_dir(
  dir_entries: State<DirEntries>,
  active_path: State<ActivePath>,
  sub_dir_count: State<SubDirectoriesCount>,
) -> Vec<PathBuf> {
  // Directory scan
  let path = &*active_path.0.lock().unwrap();
  let dir = fs::read_dir(path).expect("❌DIR NOT FOUND");
  let mut entries:Vec<PathBuf> = Vec::new();
  let mut files:Vec<PathBuf> = Vec::new();
  for entry in dir {
    if let Ok(entry) = entry {
      if let Ok(metadata) = entry.metadata() {
        if metadata.is_dir() {
          entries.push(entry.path());
        } else {
          files.push(entry.path());
        }
      }
    }
  }
  *sub_dir_count.0.lock().unwrap() = entries.len() + 1;
  // Sort files and directories, and Append
  entries.sort();
  files.sort();
  entries.append(&mut files);
  // Add parent directory to top
  entries.push( match path.parent() {
    Some(_parent) => _parent.to_path_buf(),
    _ => path.to_path_buf(),
  });
  entries.rotate_right(1);
  // Update state
  *dir_entries.0.lock().unwrap() = entries.clone();
  entries
}

#[tauri::command]
fn count_sub_dir(sub_dir_count: State<SubDirectoriesCount>) -> usize {
  *sub_dir_count.0.lock().unwrap()
}

fn main() {
  tauri::Builder::default()
  .manage(DriveEntries(scan_drive().into()))
  .manage(ActiveDrive(0.into()))
  .manage(ActivePath(Default::default()))
  .manage(DirEntries(Default::default()))
  .manage(SubDirectoriesCount(Default::default()))
  .invoke_handler(tauri::generate_handler![
    change_drive,
    scan_dir,
    change_dir,
    count_sub_dir,
  ])
  .register_uri_scheme_protocol("reqimg", move |app, request| {
    let res_not_img = ResponseBuilder::new().status(404).body(Vec::new());
    if request.method() != "GET" { return res_not_img; }
    let uri = request.uri();
    let start_pos = match uri.find("?n=") {
      Some(_pos) => _pos + 3,
      None => return res_not_img,
    };
    let end_pos = match uri.find("&") {
      Some(_pos) => _pos,
      None => return res_not_img,
    };
    let entry_num: usize = match &uri[start_pos..end_pos].parse() {
      Ok(_i) => *_i,
      Err(_) => return res_not_img,
    };
    let dir_entries: State<DirEntries> = app.state();
    let v_dirs = &*dir_entries.0.lock().unwrap();
    let target_file = match v_dirs.get(entry_num) {
      Some(_dir) => &v_dirs[entry_num],
      None => return res_not_img,
    };
    let extension = match target_file.extension() {
      Some(_ex) => _ex.to_string_lossy().to_string(),
      None => return res_not_img,
    };
    if !is_img_extension(&extension) {
      return res_not_img;
    }
    println!("🚩Request: {} / {:?}", entry_num, target_file);
    let local_img = if let Ok(data) = read(target_file) {
      tauri::http::ResponseBuilder::new()
        .mimetype(format!("image/{}", &extension).as_str())
        .body(data)
    } else {
      res_not_img
    };
    local_img
  })
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

fn is_img_extension(extension: &str) -> bool {
  let ex: [&str; 6] = ["png", "jpg", "jpeg", "gif", "bmp", "webp"];
  ex.iter().any(|e| *e == extension.to_lowercase())
}