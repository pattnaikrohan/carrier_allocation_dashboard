from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import datetime
import os
import base64
import httpx

app = FastAPI(title="AAW Dashboards API", version="1.0.0")

# CORS — allow Azure Static Web App + local dev
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://orange-wave-035251f00.7.azurestaticapps.net",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── Models ────────────────────────────────────────────────────────────────────

class DashboardCard(BaseModel):
    id: str
    title: str
    description: str
    icon: str
    route: str
    color: str
    kpi_count: int

class KPI(BaseModel):
    label: str
    value: str
    change: float
    trend: str  # "up" | "down" | "neutral"

class DashboardSummary(BaseModel):
    title: str
    last_updated: str
    kpis: List[KPI]


# ─── GitHub Integration ───────────────────────────────────────────────────────

GITHUB_REPO = os.getenv("GITHUB_REPO", "pattnaikrohan/carrier_allocation_dashboard")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN", "")
GITHUB_FILE_PATH = "frontend/src/BookingData.ts"


async def push_to_github(content: str) -> dict:
    """Push updated BookingData.ts to GitHub, which triggers the Static Web App CI/CD."""
    if not GITHUB_TOKEN:
        return {"pushed": False, "reason": "GITHUB_TOKEN not configured"}

    api_url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{GITHUB_FILE_PATH}"
    headers = {
        "Authorization": f"token {GITHUB_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
    }

    async with httpx.AsyncClient() as client:
        # Get current file SHA (required for update)
        resp = await client.get(api_url, headers=headers)
        if resp.status_code != 200:
            return {"pushed": False, "reason": f"Could not fetch file SHA: {resp.status_code}"}

        current_sha = resp.json().get("sha")

        # Push updated content
        encoded = base64.b64encode(content.encode("utf-8")).decode("utf-8")
        payload = {
            "message": f"sync: data refresh {datetime.datetime.utcnow().strftime('%Y-%m-%d %H:%M UTC')}",
            "content": encoded,
            "sha": current_sha,
            "branch": "main",
        }
        put_resp = await client.put(api_url, headers=headers, json=payload)

        if put_resp.status_code in (200, 201):
            return {"pushed": True, "commit": put_resp.json().get("commit", {}).get("sha", "unknown")}
        else:
            return {"pushed": False, "reason": f"GitHub API returned {put_resp.status_code}: {put_resp.text[:200]}"}


# ─── Routes ────────────────────────────────────────────────────────────────────


@app.get("/api/data")
async def get_data():
    """Fetch and process data from Azure Blob, return as JSON for the frontend."""
    try:
        from data_processor import process_data_from_azure_json

        data, log_lines = process_data_from_azure_json()
        return {
            "status": "success",
            "data": data,
            "log": log_lines,
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
    except Exception as e:
        import traceback
        return {
            "status": "error",
            "message": f"Data fetch failed: {str(e)}",
            "traceback": traceback.format_exc(),
            "timestamp": datetime.datetime.utcnow().isoformat()
        }


@app.post("/api/sync")
async def sync_data():
    """Triggers the data ingestion pipeline: Azure Blob → Process → JSON + optional GitHub push."""
    try:
        from data_processor import process_data_from_azure, process_data_from_azure_json

        # Step 1: Process data from Azure Blob Storage (JSON for frontend)
        json_data, log_lines = process_data_from_azure_json()

        # Step 2: Also generate TS and try pushing to GitHub (optional, for static rebuild)
        try:
            ts_content, ts_log = process_data_from_azure()
            github_result = await push_to_github(ts_content)
            log_lines.extend(ts_log)
        except Exception:
            github_result = {"pushed": False, "reason": "TS generation/push failed"}

        if github_result.get("pushed"):
            return {
                "status": "success",
                "message": f"Data synchronized and pushed to GitHub. Commit: {github_result.get('commit', 'N/A')}.",
                "data": json_data,
                "log": log_lines,
                "timestamp": datetime.datetime.utcnow().isoformat()
            }
        else:
            # GitHub push failed but data processing succeeded — return data for runtime update
            return {
                "status": "partial",
                "message": f"Data processed successfully. GitHub push skipped: {github_result.get('reason', 'unknown')}. Dashboard updated via live data.",
                "data": json_data,
                "log": log_lines,
                "timestamp": datetime.datetime.utcnow().isoformat()
            }

    except Exception as e:
        import traceback
        return {
            "status": "error",
            "message": f"Data synchronization failed: {str(e)}",
            "traceback": traceback.format_exc(),
            "timestamp": datetime.datetime.utcnow().isoformat()
        }


@app.get("/api/health")
def health():
    return {"status": "ok", "timestamp": datetime.datetime.utcnow().isoformat()}


@app.get("/api/dashboards", response_model=List[DashboardCard])
def get_dashboards():
    return [
        DashboardCard(
            id="contract",
            title="AAW Contract Dashboard",
            description="Monitor active contracts, milestones, SLA compliance, and vendor performance across all AAW operations.",
            icon="📋",
            route="/contract",
            color="cyan",
            kpi_count=8,
        ),
        DashboardCard(
            id="procurement",
            title="AAW Procurement Dashboard",
            description="Track purchase orders, supplier pipelines, spend analytics, and procurement cycle times in real time.",
            icon="📦",
            route="/procurement",
            color="purple",
            kpi_count=7,
        ),
    ]


@app.get("/api/contract/summary", response_model=DashboardSummary)
def get_contract_summary():
    return DashboardSummary(
        title="AAW Contract Dashboard",
        last_updated=datetime.datetime.utcnow().isoformat(),
        kpis=[
            KPI(label="Active Contracts", value="142", change=4.2, trend="up"),
            KPI(label="SLA Compliance", value="97.3%", change=1.1, trend="up"),
            KPI(label="Contracts Expiring (30d)", value="18", change=-5.0, trend="down"),
            KPI(label="Avg Contract Value", value="$2.4M", change=0.0, trend="neutral"),
            KPI(label="Disputes Open", value="3", change=-25.0, trend="down"),
            KPI(label="Renewals Pending", value="27", change=8.0, trend="up"),
            KPI(label="New This Month", value="11", change=10.0, trend="up"),
            KPI(label="Total Portfolio Value", value="$341M", change=2.3, trend="up"),
        ],
    )


@app.get("/api/procurement/summary", response_model=DashboardSummary)
def get_procurement_summary():
    return DashboardSummary(
        title="AAW Procurement Dashboard",
        last_updated=datetime.datetime.utcnow().isoformat(),
        kpis=[
            KPI(label="Open POs", value="89", change=6.5, trend="up"),
            KPI(label="Total Spend YTD", value="$78.2M", change=12.1, trend="up"),
            KPI(label="Avg PO Cycle Time", value="4.2 days", change=-8.0, trend="down"),
            KPI(label="Suppliers Active", value="54", change=3.8, trend="up"),
            KPI(label="Pending Approvals", value="12", change=-15.0, trend="down"),
            KPI(label="Overdue Deliveries", value="5", change=-28.0, trend="down"),
            KPI(label="Savings Realized", value="$4.1M", change=22.0, trend="up"),
        ],
    )
