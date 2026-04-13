from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import datetime

app = FastAPI(title="AAW Dashboards API", version="1.0.0")

# CORS — allow local Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
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


# ─── Routes ────────────────────────────────────────────────────────────────────

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
