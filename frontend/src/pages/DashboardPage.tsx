import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Send,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import axios from "axios";

import ComposeEmailForm from "../components/ComposeEmailForm";

interface User {
  id: string;
  name: string;
  email: string;
  avatarUrl: string | null;
}

type DashboardSection =
  | "overview"
  | "scheduled"
  | "sent"
  | "compose"
  | "slack";

interface EmailStats {
  scheduled: number;
  sent: number;
  campaigns: number;
}

interface ScheduledEmail {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  scheduledAt: string;
  status: string;
  createdAt: string;
}

interface SentEmail {
  id: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  sentAt: string | null;
  status: string;
  failureReason: string | null;
}

const API_URL = "http://localhost:5000";

const DashboardPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);

  const [activeSection, setActiveSection] =
    useState<DashboardSection>("overview");

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [stats, setStats] = useState<EmailStats>({
    scheduled: 0,
    sent: 0,
    campaigns: 0,
  });

  const [scheduledEmails, setScheduledEmails] = useState<ScheduledEmail[]>(
    [],
  );

  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);

  const [dataError, setDataError] = useState("");

  const loadDashboardData = async () => {
    const token = localStorage.getItem("reachinbox_token");

    if (!token) {
      return;
    }

    try {
      setDataLoading(true);
      setDataError("");

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [statsResponse, scheduledResponse, sentResponse] =
        await Promise.all([
          axios.get(`${API_URL}/api/emails/stats`, {
            headers,
          }),
          axios.get(`${API_URL}/api/emails/scheduled`, {
            headers,
          }),
          axios.get(`${API_URL}/api/emails/sent`, {
            headers,
          }),
        ]);

      setStats(statsResponse.data.data);
      setScheduledEmails(scheduledResponse.data.data);
      setSentEmails(sentResponse.data.data);
    } catch (error) {
      console.error("Failed to load dashboard data:", error);
      setDataError("Unable to refresh email data.");
    } finally {
      setDataLoading(false);
    }
  };

  useEffect(() => {
    const loadUser = async () => {
      const token = localStorage.getItem("reachinbox_token");

      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        setUser(response.data.user);

        await loadDashboardData();
      } catch (error) {
        console.error("Failed to load user:", error);

        localStorage.removeItem("reachinbox_token");
        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    };

    void loadUser();
  }, []);

  const handleLogout = () => {
    localStorage.removeItem("reachinbox_token");
    window.location.href = "/login";
  };

  const handleNavigation = (section: DashboardSection) => {
    setActiveSection(section);
    setMobileMenuOpen(false);

    void loadDashboardData();
  };

  const formatDate = (date: string | null) => {
    if (!date) {
      return "-";
    }

    return new Date(date).toLocaleString("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  };

  if (loading) {
    return (
      <>
        <style>
          {`
            .reach-loading {
              min-height: 100vh;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              background:
                radial-gradient(circle at 20% 20%, rgba(99,102,241,.16), transparent 30%),
                radial-gradient(circle at 80% 80%, rgba(14,165,233,.13), transparent 30%),
                #f8fafc;
              color: #475569;
              gap: 16px;
            }

            .reach-loader {
              width: 46px;
              height: 46px;
              border-radius: 50%;
              border: 4px solid rgba(99,102,241,.15);
              border-top-color: #6366f1;
              animation: reach-spin .8s linear infinite;
            }

            @keyframes reach-spin {
              to { transform: rotate(360deg); }
            }
          `}
        </style>

        <div className="reach-loading">
          <div className="reach-loader" />
          <p>Loading your workspace...</p>
        </div>
      </>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <>
      <style>
        {`
          .dashboard-shell {
            position: relative;
            min-height: 100vh;
            overflow-x: hidden;
            background:
              radial-gradient(circle at 5% 5%, rgba(99,102,241,.09), transparent 25%),
              radial-gradient(circle at 95% 90%, rgba(14,165,233,.08), transparent 25%),
              #f8fafc;
          }

          .dashboard-shell::before {
            content: "";
            position: fixed;
            width: 420px;
            height: 420px;
            border-radius: 50%;
            background: rgba(99,102,241,.05);
            filter: blur(80px);
            top: -180px;
            right: -120px;
            pointer-events: none;
            animation: floatingGlow 8s ease-in-out infinite;
          }

          .dashboard-shell::after {
            content: "";
            position: fixed;
            width: 320px;
            height: 320px;
            border-radius: 50%;
            background: rgba(14,165,233,.05);
            filter: blur(80px);
            bottom: -120px;
            left: 240px;
            pointer-events: none;
            animation: floatingGlow 10s ease-in-out infinite reverse;
          }

          @keyframes floatingGlow {
            0%, 100% {
              transform: translate3d(0,0,0);
            }
            50% {
              transform: translate3d(0,20px,0);
            }
          }

          .dashboard-main {
            position: relative;
            z-index: 1;
          }

          .topbar-title h1 {
            animation: titleIn .45s ease both;
          }

          .topbar-title p {
            animation: titleIn .55s ease both;
          }

          @keyframes titleIn {
            from {
              opacity: 0;
              transform: translateY(8px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .dashboard-data-error {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 16px;
            margin-bottom: 20px;
            padding: 12px 16px;
            border: 1px solid #fecaca;
            border-radius: 14px;
            background: rgba(254,242,242,.92);
            color: #b91c1c;
            font-size: 14px;
          }

          .dashboard-refresh-button {
            display: inline-flex;
            align-items: center;
            gap: 7px;
            border: 1px solid #e2e8f0;
            border-radius: 10px;
            padding: 8px 12px;
            background: white;
            color: #475569;
            cursor: pointer;
            transition: all .2s ease;
          }

          .dashboard-refresh-button:hover {
            border-color: #c7d2fe;
            background: #eef2ff;
            color: #4f46e5;
            transform: translateY(-1px);
          }

          .dashboard-refresh-icon {
            animation: refreshSpin .8s linear infinite;
          }

          @keyframes refreshSpin {
            to {
              transform: rotate(360deg);
            }
          }

          .stats-grid {
            animation: cardsIn .55s ease both;
          }

          @keyframes cardsIn {
            from {
              opacity: 0;
              transform: translateY(14px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .stat-card {
            position: relative;
            overflow: hidden;
            transition:
              transform .25s ease,
              box-shadow .25s ease,
              border-color .25s ease;
          }

          .stat-card::before {
            content: "";
            position: absolute;
            width: 120px;
            height: 120px;
            border-radius: 50%;
            background: rgba(99,102,241,.07);
            top: -65px;
            right: -55px;
            transition: transform .3s ease;
          }

          .stat-card:hover {
            transform: translateY(-5px);
            box-shadow: 0 18px 45px rgba(15,23,42,.09);
            border-color: #c7d2fe;
          }

          .stat-card:hover::before {
            transform: scale(1.35);
          }

          .stat-icon {
            transition: transform .25s ease;
          }

          .stat-card:hover .stat-icon {
            transform: scale(1.08) rotate(-4deg);
          }

          .dashboard-panel {
            animation: panelIn .5s ease both;
          }

          @keyframes panelIn {
            from {
              opacity: 0;
              transform: translateY(10px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          .table-container {
            overflow: hidden;
          }

          .dashboard-table-row {
            transition:
              background .2s ease,
              transform .2s ease;
          }

          .dashboard-table-row:hover {
            background: #f8fafc;
          }

          .dashboard-table-row td {
            transition: color .2s ease;
          }

          .status-pill {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            border-radius: 999px;
            padding: 5px 10px;
            font-size: 12px;
            font-weight: 600;
          }

          .status-dot {
            width: 6px;
            height: 6px;
            border-radius: 50%;
            background: currentColor;
          }

          .status-scheduled {
            background: #eef2ff;
            color: #4f46e5;
          }

          .status-processing {
            background: #fff7ed;
            color: #c2410c;
          }

          .status-sent {
            background: #ecfdf5;
            color: #047857;
          }

          .status-failed {
            background: #fef2f2;
            color: #dc2626;
          }

          .dashboard-count-badge {
            display: inline-flex;
            min-width: 28px;
            height: 28px;
            align-items: center;
            justify-content: center;
            border-radius: 999px;
            background: #eef2ff;
            color: #4f46e5;
            font-size: 12px;
            font-weight: 700;
          }

          .dashboard-table-email {
            display: flex;
            align-items: center;
            gap: 10px;
            min-width: 0;
          }

          .dashboard-email-avatar {
            width: 34px;
            height: 34px;
            flex: 0 0 34px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 10px;
            background: linear-gradient(135deg, #eef2ff, #e0f2fe);
            color: #4f46e5;
          }

          .dashboard-email-text {
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
          }

          .dashboard-skeleton {
            height: 17px;
            border-radius: 7px;
            background: linear-gradient(
              90deg,
              #f1f5f9 25%,
              #e2e8f0 50%,
              #f1f5f9 75%
            );
            background-size: 200% 100%;
            animation: skeleton 1.4s infinite;
          }

          @keyframes skeleton {
            to {
              background-position: -200% 0;
            }
          }

          .dashboard-empty-icon {
            animation: emptyFloat 3s ease-in-out infinite;
          }

          @keyframes emptyFloat {
            0%, 100% {
              transform: translateY(0);
            }
            50% {
              transform: translateY(-5px);
            }
          }

          .sidebar-brand-icon {
            transition: transform .25s ease;
          }

          .sidebar-brand:hover .sidebar-brand-icon {
            transform: rotate(-6deg) scale(1.06);
          }

          .nav-item {
            transition:
              transform .2s ease,
              background .2s ease,
              color .2s ease;
          }

          .nav-item:hover {
            transform: translateX(3px);
          }

          .topbar-compose-button,
          .primary-button {
            transition:
              transform .2s ease,
              box-shadow .2s ease;
          }

          .topbar-compose-button:hover,
          .primary-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 10px 25px rgba(79,70,229,.18);
          }

          .welcome-section {
            animation: welcomeIn .5s ease both;
          }

          @keyframes welcomeIn {
            from {
              opacity: 0;
              transform: translateY(12px);
            }
            to {
              opacity: 1;
              transform: translateY(0);
            }
          }

          @media (max-width: 768px) {
            .dashboard-data-error {
              align-items: flex-start;
              flex-direction: column;
            }

            .dashboard-table-email {
              max-width: 220px;
            }
          }
        `}
      </style>

      <div className="dashboard-shell">
        {mobileMenuOpen && (
          <button
            type="button"
            className="mobile-overlay"
            aria-label="Close navigation"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        <aside
          className={`dashboard-sidebar ${
            mobileMenuOpen ? "sidebar-open" : ""
          }`}
        >
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">
              <Mail size={20} />
            </div>

            <span>ReachInbox</span>

            <button
              type="button"
              className="mobile-close-button"
              onClick={() => setMobileMenuOpen(false)}
              aria-label="Close menu"
            >
              <X size={20} />
            </button>
          </div>

          <nav className="sidebar-nav">
            <p className="nav-label">WORKSPACE</p>

            <button
              type="button"
              className={`nav-item ${
                activeSection === "overview" ? "active" : ""
              }`}
              onClick={() => handleNavigation("overview")}
            >
              <Mail size={18} />
              <span>Overview</span>
            </button>

            <button
              type="button"
              className={`nav-item ${
                activeSection === "scheduled" ? "active" : ""
              }`}
              onClick={() => handleNavigation("scheduled")}
            >
              <CalendarClock size={18} />
              <span>Scheduled Emails</span>

              {stats.scheduled > 0 && (
                <span className="dashboard-count-badge">
                  {stats.scheduled}
                </span>
              )}
            </button>

            <button
              type="button"
              className={`nav-item ${
                activeSection === "sent" ? "active" : ""
              }`}
              onClick={() => handleNavigation("sent")}
            >
              <Send size={18} />
              <span>Sent Emails</span>

              {stats.sent > 0 && (
                <span className="dashboard-count-badge">
                  {stats.sent}
                </span>
              )}
            </button>

            <p className="nav-label nav-label-spaced">CAMPAIGNS</p>

            <button
              type="button"
              className={`nav-item ${
                activeSection === "compose" ? "active" : ""
              }`}
              onClick={() => handleNavigation("compose")}
            >
              <Plus size={18} />
              <span>Compose New Email</span>
            </button>

            <p className="nav-label nav-label-spaced">INTEGRATIONS</p>

            <button
              type="button"
              className={`nav-item ${
                activeSection === "slack" ? "active" : ""
              }`}
              onClick={() => handleNavigation("slack")}
            >
              <MessageSquare size={18} />
              <span>Slack</span>
            </button>
          </nav>

          <div className="sidebar-bottom">
            <button type="button" className="nav-item">
              <Settings size={18} />
              <span>Settings</span>
            </button>

            <div className="sidebar-user">
              {user.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="sidebar-avatar"
                />
              ) : (
                <div className="sidebar-avatar sidebar-avatar-fallback">
                  {user.name.charAt(0).toUpperCase()}
                </div>
              )}

              <div className="sidebar-user-info">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
              </div>

              <button
                type="button"
                className="sidebar-logout"
                onClick={handleLogout}
                title="Logout"
                aria-label="Logout"
              >
                <LogOut size={17} />
              </button>
            </div>
          </div>
        </aside>

        <main className="dashboard-main">
          <header className="dashboard-topbar">
            <button
              type="button"
              className="mobile-menu-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>

            <div className="topbar-title">
              <h1>
                {activeSection === "overview" && "Overview"}
                {activeSection === "scheduled" && "Scheduled Emails"}
                {activeSection === "sent" && "Sent Emails"}
                {activeSection === "compose" && "Compose New Email"}
                {activeSection === "slack" && "Slack Integration"}
              </h1>

              <p>Manage your email campaigns and delivery workflow.</p>
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <button
                type="button"
                className="dashboard-refresh-button"
                onClick={() => void loadDashboardData()}
                title="Refresh dashboard"
              >
                <RefreshCw
                  size={16}
                  className={dataLoading ? "dashboard-refresh-icon" : ""}
                />
                <span className="desktop-refresh-text">Refresh</span>
              </button>

              <button
                type="button"
                className="topbar-compose-button"
                onClick={() => handleNavigation("compose")}
              >
                <Plus size={17} />
                New Email
              </button>
            </div>
          </header>

          <div className="dashboard-content">
            {dataError && (
              <div className="dashboard-data-error">
                <span>{dataError}</span>

                <button
                  type="button"
                  className="dashboard-refresh-button"
                  onClick={() => void loadDashboardData()}
                >
                  <RefreshCw size={15} />
                  Retry
                </button>
              </div>
            )}

            {activeSection === "overview" && (
              <OverviewContent
                user={user}
                stats={stats}
                loading={dataLoading}
                scheduledEmails={scheduledEmails}
                onCompose={() => handleNavigation("compose")}
                onScheduled={() => handleNavigation("scheduled")}
              />
            )}

            {activeSection === "scheduled" && (
              <ScheduledContent
                emails={scheduledEmails}
                loading={dataLoading}
                formatDate={formatDate}
              />
            )}

            {activeSection === "sent" && (
              <SentContent
                emails={sentEmails}
                loading={dataLoading}
                formatDate={formatDate}
              />
            )}

            {activeSection === "compose" && <ComposeContent />}

            {activeSection === "slack" && <SlackContent />}
          </div>
        </main>
      </div>
    </>
  );
};

interface OverviewContentProps {
  user: User;
  stats: EmailStats;
  loading: boolean;
  scheduledEmails: ScheduledEmail[];
  onCompose: () => void;
  onScheduled: () => void;
}

const OverviewContent = ({
  user,
  stats,
  loading,
  scheduledEmails,
  onCompose,
  onScheduled,
}: OverviewContentProps) => {
  return (
    <>
      <section className="welcome-section">
        <div>
          <p className="section-eyebrow">YOUR WORKSPACE</p>

          <h2>
            Welcome back, {user.name.split(" ")[0]} 👋
          </h2>

          <p>
            Here's what's happening with your email campaigns.
          </p>
        </div>

        <button
          type="button"
          className="primary-button"
          onClick={onCompose}
        >
          <Plus size={18} />
          Compose Email
        </button>
      </section>

      <section className="stats-grid">
        <StatCard
          icon={<Clock3 size={20} />}
          label="Scheduled"
          value={loading ? "..." : String(stats.scheduled)}
          description="Emails waiting to be sent"
        />

        <StatCard
          icon={<CheckCircle2 size={20} />}
          label="Sent"
          value={loading ? "..." : String(stats.sent)}
          description="Successfully delivered"
        />

        <StatCard
          icon={<Send size={20} />}
          label="Campaigns"
          value={loading ? "..." : String(stats.campaigns)}
          description="Email batches created"
        />
      </section>

      <section className="dashboard-panel">
        <div className="panel-header">
          <div>
            <h3>Recent Activity</h3>

            <p>
              Your latest email activity will appear here.
            </p>
          </div>

          {scheduledEmails.length > 0 && (
            <button
              type="button"
              className="dashboard-refresh-button"
              onClick={onScheduled}
            >
              View all
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: "24px" }}>
            <div className="dashboard-skeleton" />
            <div
              className="dashboard-skeleton"
              style={{ marginTop: 12, width: "75%" }}
            />
            <div
              className="dashboard-skeleton"
              style={{ marginTop: 12, width: "55%" }}
            />
          </div>
        ) : scheduledEmails.length === 0 ? (
          <EmptyState
            icon={<Mail size={28} />}
            title="No email activity yet"
            description="Create your first email campaign to get started."
          />
        ) : (
          <div className="table-container">
            <div className="table-header scheduled-grid">
              <span>Email</span>
              <span>Subject</span>
              <span>Scheduled Time</span>
              <span>Status</span>
            </div>

            {scheduledEmails.slice(0, 5).map((email) => (
              <div
                key={email.id}
                className="table-row scheduled-grid dashboard-table-row"
              >
                <div className="dashboard-table-email">
                  <div className="dashboard-email-avatar">
                    <Mail size={16} />
                  </div>

                  <span className="dashboard-email-text">
                    {email.recipientEmail}
                  </span>
                </div>

                <span>{email.subject}</span>

                <span>
                  {new Date(email.scheduledAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </span>

                <StatusBadge status={email.status} />
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
};

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}

const StatCard = ({
  icon,
  label,
  value,
  description,
}: StatCardProps) => {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>

      <div>
        <p className="stat-label">{label}</p>
        <strong>{value}</strong>
        <span>{description}</span>
      </div>
    </div>
  );
};

interface ScheduledContentProps {
  emails: ScheduledEmail[];
  loading: boolean;
  formatDate: (date: string | null) => string;
}

const ScheduledContent = ({
  emails,
  loading,
  formatDate,
}: ScheduledContentProps) => {
  return (
    <section className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h3>Scheduled Emails</h3>

          <p>
            Emails waiting for their scheduled delivery time.
          </p>
        </div>

        <div className="dashboard-count-badge">
          {emails.length}
        </div>
      </div>

      <div className="table-container">
        <div className="table-header scheduled-grid">
          <span>Email</span>
          <span>Subject</span>
          <span>Scheduled Time</span>
          <span>Status</span>
        </div>

        {loading ? (
          <div style={{ padding: "24px" }}>
            <div className="dashboard-skeleton" />
            <div
              className="dashboard-skeleton"
              style={{ marginTop: 14 }}
            />
            <div
              className="dashboard-skeleton"
              style={{ marginTop: 14, width: "80%" }}
            />
          </div>
        ) : emails.length === 0 ? (
          <EmptyState
            icon={<CalendarClock size={28} />}
            title="No scheduled emails"
            description="Scheduled emails will appear here."
          />
        ) : (
          emails.map((email) => (
            <div
              key={email.id}
              className="table-row scheduled-grid dashboard-table-row"
            >
              <div className="dashboard-table-email">
                <div className="dashboard-email-avatar">
                  <Mail size={16} />
                </div>

                <span className="dashboard-email-text">
                  {email.recipientEmail}
                </span>
              </div>

              <span>{email.subject}</span>

              <span>{formatDate(email.scheduledAt)}</span>

              <StatusBadge status={email.status} />
            </div>
          ))
        )}
      </div>
    </section>
  );
};

interface SentContentProps {
  emails: SentEmail[];
  loading: boolean;
  formatDate: (date: string | null) => string;
}

const SentContent = ({
  emails,
  loading,
  formatDate,
}: SentContentProps) => {
  return (
    <section className="dashboard-panel">
      <div className="panel-header">
        <div>
          <h3>Sent Emails</h3>

          <p>
            Track your previously delivered emails.
          </p>
        </div>

        <div className="dashboard-count-badge">
          {emails.length}
        </div>
      </div>

      <div className="table-container">
        <div className="table-header sent-grid">
          <span>Email</span>
          <span>Subject</span>
          <span>Sent Time</span>
          <span>Status</span>
        </div>

        {loading ? (
          <div style={{ padding: "24px" }}>
            <div className="dashboard-skeleton" />
            <div
              className="dashboard-skeleton"
              style={{ marginTop: 14 }}
            />
            <div
              className="dashboard-skeleton"
              style={{ marginTop: 14, width: "80%" }}
            />
          </div>
        ) : emails.length === 0 ? (
          <EmptyState
            icon={<CheckCircle2 size={28} />}
            title="No sent emails"
            description="Successfully sent emails will appear here."
          />
        ) : (
          emails.map((email) => (
            <div
              key={email.id}
              className="table-row sent-grid dashboard-table-row"
            >
              <div className="dashboard-table-email">
                <div className="dashboard-email-avatar">
                  <Send size={16} />
                </div>

                <span className="dashboard-email-text">
                  {email.recipientEmail}
                </span>
              </div>

              <span>{email.subject}</span>

              <span>{formatDate(email.sentAt)}</span>

              <StatusBadge status={email.status} />
            </div>
          ))
        )}
      </div>
    </section>
  );
};

const StatusBadge = ({ status }: { status: string }) => {
  const normalizedStatus = status.toUpperCase();

  let className = "status-scheduled";

  if (normalizedStatus === "SENT") {
    className = "status-sent";
  } else if (normalizedStatus === "FAILED") {
    className = "status-failed";
  } else if (normalizedStatus === "PROCESSING") {
    className = "status-processing";
  }

  return (
    <span className={`status-pill ${className}`}>
      <span className="status-dot" />
      {normalizedStatus}
    </span>
  );
};

const ComposeContent = () => {
  return (
    <section className="compose-layout">
      <div className="dashboard-panel compose-panel">
        <div className="panel-header">
          <div>
            <h3>Compose New Email</h3>

            <p>
              Create and schedule an email campaign.
            </p>
          </div>
        </div>

        <div className="compose-form-container">
          <ComposeEmailForm />
        </div>
      </div>
    </section>
  );
};

const SlackContent = () => {
  return (
    <section className="dashboard-panel slack-panel">
      <div className="slack-icon">
        <MessageSquare size={28} />
      </div>

      <h2>Connect Slack</h2>

      <p>
        Receive a Slack notification when your email sending
        limit is reached.
      </p>

      <button type="button" className="primary-button">
        <MessageSquare size={18} />
        Connect Slack
      </button>

      <span className="integration-note">
        Slack integration will be connected through OAuth.
      </span>
    </section>
  );
};

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const EmptyState = ({
  icon,
  title,
  description,
}: EmptyStateProps) => {
  return (
    <div className="empty-state">
      <div className="empty-state-icon dashboard-empty-icon">
        {icon}
      </div>

      <h4>{title}</h4>

      <p>{description}</p>
    </div>
  );
};

export default DashboardPage;