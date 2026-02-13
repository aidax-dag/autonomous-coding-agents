use serde::{Deserialize, Serialize};

const API_BASE: &str = "http://localhost:3000/api";

#[derive(Debug, Serialize, Deserialize)]
pub struct HealthResponse {
    pub status: String,
    pub health: f64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AgentSnapshot {
    #[serde(rename = "agentId")]
    pub agent_id: String,
    #[serde(rename = "teamType")]
    pub team_type: String,
    pub status: String,
    #[serde(rename = "currentTask")]
    pub current_task: Option<String>,
    #[serde(rename = "tasksCompleted")]
    pub tasks_completed: u32,
    #[serde(rename = "tasksFailed")]
    pub tasks_failed: u32,
    pub uptime: u64,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DashboardSnapshot {
    #[serde(rename = "systemHealth")]
    pub system_health: f64,
    pub agents: Vec<AgentSnapshot>,
    #[serde(rename = "activeWorkflows")]
    pub active_workflows: u32,
    #[serde(rename = "totalTasksCompleted")]
    pub total_tasks_completed: u32,
    #[serde(rename = "totalTasksFailed")]
    pub total_tasks_failed: u32,
    pub uptime: u64,
    pub timestamp: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitTaskRequest {
    pub name: String,
    pub description: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SubmitTaskResponse {
    #[serde(rename = "taskId")]
    pub task_id: String,
    pub status: String,
}

#[tauri::command]
pub async fn get_health() -> Result<HealthResponse, String> {
    let client = reqwest::Client::new();
    client
        .get(format!("{API_BASE}/health"))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<HealthResponse>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_snapshot() -> Result<DashboardSnapshot, String> {
    let client = reqwest::Client::new();
    client
        .get(format!("{API_BASE}/snapshot"))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<DashboardSnapshot>()
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_agents() -> Result<Vec<AgentSnapshot>, String> {
    #[derive(Deserialize)]
    struct AgentsResponse {
        agents: Vec<AgentSnapshot>,
    }

    let client = reqwest::Client::new();
    let resp = client
        .get(format!("{API_BASE}/agents"))
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<AgentsResponse>()
        .await
        .map_err(|e| e.to_string())?;

    Ok(resp.agents)
}

#[tauri::command]
pub async fn submit_task(name: String, description: String) -> Result<SubmitTaskResponse, String> {
    let client = reqwest::Client::new();
    client
        .post(format!("{API_BASE}/tasks"))
        .json(&SubmitTaskRequest { name, description })
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json::<SubmitTaskResponse>()
        .await
        .map_err(|e| e.to_string())
}
