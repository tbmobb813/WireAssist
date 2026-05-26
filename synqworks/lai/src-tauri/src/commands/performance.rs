use serde::{Deserialize, Serialize};
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use sysinfo::{CpuRefreshKind, MemoryRefreshKind, Pid, ProcessRefreshKind, RefreshKind, System};

static SYSTEM: OnceLock<Mutex<System>> = OnceLock::new();
static LAST_UPDATE: OnceLock<Mutex<Instant>> = OnceLock::new();

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub cpu_usage: f32,
    pub memory_usage: MemoryInfo,
    pub process_info: ProcessInfo,
    pub uptime: u64,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryInfo {
    pub total_memory: u64,
    pub used_memory: u64,
    pub available_memory: u64,
    pub memory_percent: f32,
    pub total_swap: u64,
    pub used_swap: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessInfo {
    pub pid: u32,
    pub cpu_usage: f32,
    pub memory_usage: u64,
    pub thread_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DatabaseMetrics {
    pub conversation_count: i64,
    pub message_count: i64,
    pub database_size: u64,
}

fn init_system() -> &'static Mutex<System> {
    SYSTEM.get_or_init(|| {
        let sys = System::new_with_specifics(
            RefreshKind::new()
                .with_cpu(CpuRefreshKind::everything())
                .with_memory(MemoryRefreshKind::new().with_ram().with_swap())
                .with_processes(ProcessRefreshKind::new()),
        );
        Mutex::new(sys)
    })
}

fn init_last_update() -> &'static Mutex<Instant> {
    LAST_UPDATE.get_or_init(|| Mutex::new(Instant::now() - Duration::from_secs(10)))
}

pub fn get_system_metrics() -> Result<SystemMetrics, String> {
    let system_mutex = init_system();
    let last_update_mutex = init_last_update();

    let mut system = system_mutex.lock().map_err(|e| e.to_string())?;
    let mut last_update = last_update_mutex.lock().map_err(|e| e.to_string())?;

    // Only refresh if it's been more than 1 second since last update
    let now = Instant::now();
    if now.duration_since(*last_update) > Duration::from_secs(1) {
        system.refresh_cpu();
        system.refresh_memory();
        system.refresh_processes();
        *last_update = now;
    }

    let current_pid = std::process::id();
    let process = system
        .process(Pid::from_u32(current_pid))
        .ok_or("Failed to get current process info")?;

    let total_memory = system.total_memory();
    let used_memory = system.used_memory();
    let available_memory = system.available_memory();
    let memory_percent = if total_memory > 0 {
        (used_memory as f32 / total_memory as f32) * 100.0
    } else {
        0.0
    };

    Ok(SystemMetrics {
        cpu_usage: system.global_cpu_info().cpu_usage(),
        memory_usage: MemoryInfo {
            total_memory,
            used_memory,
            available_memory,
            memory_percent,
            total_swap: system.total_swap(),
            used_swap: system.used_swap(),
        },
        process_info: ProcessInfo {
            pid: current_pid,
            cpu_usage: process.cpu_usage(),
            memory_usage: process.memory(),
            thread_count: process.tasks().map(|tasks| tasks.len()).unwrap_or(0),
        },
        uptime: System::uptime(),
        timestamp: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64,
    })
}

#[tauri::command]
pub async fn get_performance_metrics() -> Result<SystemMetrics, String> {
    get_system_metrics()
}

#[tauri::command]
pub async fn get_database_metrics(
    db: tauri::State<'_, crate::database::Database>,
) -> Result<DatabaseMetrics, String> {
    let conn = db.conn().lock().map_err(|e| e.to_string())?;

    // Get conversation count
    let conversation_count: i64 = conn
        .prepare("SELECT COUNT(*) FROM conversations WHERE deleted = 0")
        .and_then(|mut stmt| stmt.query_row([], |row| row.get(0)))
        .map_err(|e| e.to_string())?;

    // Get message count
    let message_count: i64 = conn
        .prepare("SELECT COUNT(*) FROM messages WHERE deleted = 0")
        .and_then(|mut stmt| stmt.query_row([], |row| row.get(0)))
        .map_err(|e| e.to_string())?;

    // Get database file size
    let database_size = match conn.path() {
        Some(path) => std::fs::metadata(path).map_err(|e| e.to_string())?.len(),
        None => {
            // Database is in-memory or path is unavailable
            0
        }
    };

    Ok(DatabaseMetrics {
        conversation_count,
        message_count,
        database_size,
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceSnapshot {
    pub system: SystemMetrics,
    pub database: DatabaseMetrics,
}

#[tauri::command]
pub async fn get_full_performance_snapshot(
    db: tauri::State<'_, crate::database::Database>,
) -> Result<PerformanceSnapshot, String> {
    let system = get_system_metrics()?;
    let database = get_database_metrics(db).await?;

    Ok(PerformanceSnapshot { system, database })
}
