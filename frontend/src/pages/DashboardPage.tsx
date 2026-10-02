import {
  Activity,
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Command,
  ExternalLink,
  FileText,
  LogOut,
  Mail,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Sparkles,
  TrendingUp,
  Users,
  X,
  Zap,
} from "lucide-react";

import {
  useEffect,
  useMemo,
  useState,
  type KeyboardEvent,
} from "react";

import axios from "axios";

import ComposeEmailForm from "../components/ComposeEmailForm";

/* =========================================================
   TYPES
========================================================= */

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

interface SearchResult {
  emailId: string;
  userId: string;
  recipientEmail: string;
  recipientName: string | null;
  subject: string;
  body: string;
  status: string;
  scheduledAt: string;
  sentAt: string | null;
  failureReason: string | null;
}

interface DashboardHealth {
  api: "online" | "offline";
  database: "connected" | "unknown";
  search: "available" | "unavailable";
  scheduler: "active" | "unknown";
}

interface ActivityItem {
  id: string;
  title: string;
  description: string;
  time: string;
  type: "scheduled" | "sent" | "campaign";
}

interface QuickAction {
  label: string;
  description: string;
  icon: React.ReactNode;
  section: DashboardSection;
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
  trend?: string;
  trendType?: "positive" | "neutral";
}

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

interface TableLoadingProps {
  rows?: number;
}

interface StatusBadgeProps {
  status: string;
}

/* =========================================================
   CONFIGURATION
========================================================= */
const API_URL = "https://reachinbox-assignment-t7ms.onrender.com";

const TOKEN_KEY = "reachinbox_token";

const SEARCH_MIN_LENGTH = 2;

const SEARCH_DEBOUNCE_MS = 350;

const DASHBOARD_REFRESH_INTERVAL = 30000;

/* =========================================================
   SHARED DATE FORMATTERS
   These are outside DashboardPage so all dashboard
   components can safely use them.
========================================================= */

const formatDashboardDate = (
  date: string | null,
): string => {
  if (!date) {
    return "-";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
};

const formatDashboardShortDate = (
  date: string | null,
): string => {
  if (!date) {
    return "-";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleDateString(
    "en-IN",
    {
      day: "2-digit",
      month: "short",
    },
  );
};

const formatDashboardTime = (
  date: string | null,
): string => {
  if (!date) {
    return "-";
  }

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) {
    return "-";
  }

  return parsedDate.toLocaleTimeString(
    "en-IN",
    {
      hour: "2-digit",
      minute: "2-digit",
    },
  );
};

/* =========================================================
   DASHBOARD PAGE
========================================================= */

const DashboardPage = () => {
  /* =======================================================
     AUTHENTICATED USER
  ======================================================= */

  const [user, setUser] =
    useState<User | null>(null);

  const [loading, setLoading] =
    useState(true);

  /* =======================================================
     DASHBOARD DATA
  ======================================================= */

  const [dataLoading, setDataLoading] =
    useState(true);

  const [stats, setStats] =
    useState<EmailStats>({
      scheduled: 0,
      sent: 0,
      campaigns: 0,
    });

  const [scheduledEmails, setScheduledEmails] =
    useState<ScheduledEmail[]>([]);

  const [sentEmails, setSentEmails] =
    useState<SentEmail[]>([]);

  const [dataError, setDataError] =
    useState("");

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const [activeSection, setActiveSection] =
    useState<DashboardSection>(
      "overview",
    );

  const [mobileMenuOpen, setMobileMenuOpen] =
    useState(false);

  /* =======================================================
     SLACK
  ======================================================= */

  const [slackLoading, setSlackLoading] =
    useState(false);

  const [slackMessage, setSlackMessage] =
    useState("");

  const [slackConnected, setSlackConnected] =
    useState(false);

  /* =======================================================
     ELASTICSEARCH SEARCH
  ======================================================= */

  const [searchQuery, setSearchQuery] =
    useState("");

  const [searchResults, setSearchResults] =
    useState<SearchResult[]>([]);

  const [searchLoading, setSearchLoading] =
    useState(false);

  const [searchError, setSearchError] =
    useState("");

  const [searchOpen, setSearchOpen] =
    useState(false);

  const [searchFocused, setSearchFocused] =
    useState(false);

  /* =======================================================
     DASHBOARD HEALTH
  ======================================================= */

  const [health, setHealth] =
    useState<DashboardHealth>({
      api: "online",
      database: "connected",
      search: "available",
      scheduler: "active",
    });

  /* =======================================================
     UI STATE
  ======================================================= */

  const [refreshing, setRefreshing] =
    useState(false);

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  /* =======================================================
     LOAD DASHBOARD DATA
  ======================================================= */

  const loadDashboardData = async () => {
    const token =
      localStorage.getItem(TOKEN_KEY);

    if (!token) {
      return;
    }

    try {
      setDataLoading(true);

      setDataError("");

      const headers = {
        Authorization: `Bearer ${token}`,
      };

      const [
        statsResponse,
        scheduledResponse,
        sentResponse,
      ] = await Promise.all([
        axios.get(
          `${API_URL}/api/emails/stats`,
          {
            headers,
          },
        ),

        axios.get(
          `${API_URL}/api/emails/scheduled`,
          {
            headers,
          },
        ),

        axios.get(
          `${API_URL}/api/emails/sent`,
          {
            headers,
          },
        ),
      ]);

      setStats(
        statsResponse.data.data ?? {
          scheduled: 0,
          sent: 0,
          campaigns: 0,
        },
      );

      setScheduledEmails(
        scheduledResponse.data.data ?? [],
      );

      setSentEmails(
        sentResponse.data.data ?? [],
      );

      setHealth((current) => ({
        ...current,
        api: "online",
        database: "connected",
        scheduler: "active",
      }));

      setLastUpdated(new Date());
    } catch (error) {
      console.error(
        "Failed to load dashboard data:",
        error,
      );

      setDataError(
        "Unable to refresh email data. Please try again.",
      );

      setHealth((current) => ({
        ...current,
        api: "offline",
      }));
    } finally {
      setDataLoading(false);
    }
  };

  /* =======================================================
     MANUAL REFRESH
  ======================================================= */

  const handleRefresh = async () => {
    if (refreshing) {
      return;
    }

    try {
      setRefreshing(true);

      await loadDashboardData();
    } finally {
      setRefreshing(false);
    }
  };

  /* =======================================================
     LOAD AUTHENTICATED USER
  ======================================================= */

  useEffect(() => {
    const loadUser = async () => {
      const token =
        localStorage.getItem(
          TOKEN_KEY,
        );

      if (!token) {
        window.location.href = "/login";
        return;
      }

      try {
        const response =
          await axios.get(
            `${API_URL}/api/auth/me`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            },
          );

        setUser(response.data.user);

        await loadDashboardData();
      } catch (error) {
        console.error(
          "Failed to load authenticated user:",
          error,
        );

        localStorage.removeItem(
          TOKEN_KEY,
        );

        window.location.href = "/login";
      } finally {
        setLoading(false);
      }
    };

    void loadUser();
  }, []);

  /* =======================================================
     AUTO REFRESH
  ======================================================= */

  useEffect(() => {
    if (!user) {
      return;
    }

    const refreshTimer =
      window.setInterval(
        () => {
          void loadDashboardData();
        },
        DASHBOARD_REFRESH_INTERVAL,
      );

    return () => {
      window.clearInterval(
        refreshTimer,
      );
    };
  }, [user]);

  /* =======================================================
     SLACK OAUTH CALLBACK
  ======================================================= */

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search,
      );

    const slackStatus =
      params.get("slack");

    if (slackStatus === "connected") {
      setActiveSection("slack");

      setSlackConnected(true);

      setSlackMessage(
        "Slack connected successfully. You will receive notifications when an hourly sending limit is reached.",
      );

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname,
      );
    }

    if (slackStatus === "error") {
      setActiveSection("slack");

      setSlackMessage(
        "Unable to connect Slack. Please try again.",
      );

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname,
      );
    }
  }, []);

  /* =======================================================
     CHECK SLACK CONNECTION
  ======================================================= */

  const checkSlackConnection = async () => {
    const token =
      localStorage.getItem(
        TOKEN_KEY,
      );

    if (!token) {
      return;
    }

    /*
     * The current backend does not expose a
     * dedicated Slack status endpoint.
     *
     * Therefore successful OAuth callback
     * controls the connected state for this
     * session.
     */
    try {
      setSlackConnected(
        (current) => current,
      );
    } catch (error) {
      console.error(
        "Failed to check Slack connection:",
        error,
      );
    }
  };

  useEffect(() => {
    void checkSlackConnection();
  }, []);

  /* =======================================================
     LOGOUT
  ======================================================= */

  const handleLogout = () => {
    localStorage.removeItem(
      TOKEN_KEY,
    );

    window.location.href = "/login";
  };

  /* =======================================================
     NAVIGATION
  ======================================================= */

  const handleNavigation = (
    section: DashboardSection,
  ) => {
    setActiveSection(section);

    setMobileMenuOpen(false);

    if (section !== "slack") {
      setSlackMessage("");
    }

    void loadDashboardData();
  };

  /* =======================================================
     SLACK CONNECT
  ======================================================= */

  const handleSlackConnect = async () => {
    const token =
      localStorage.getItem(
        TOKEN_KEY,
      );

    if (!token) {
      window.location.href = "/login";
      return;
    }

    try {
      setSlackLoading(true);

      setSlackMessage("");

      const response =
        await axios.get(
          `${API_URL}/api/slack/authorize-url`,
          {
            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const authorizationUrl =
        response.data.authorizationUrl;

      if (!authorizationUrl) {
        throw new Error(
          "Slack authorization URL was not returned.",
        );
      }

      window.location.href =
        authorizationUrl;
    } catch (error) {
      console.error(
        "Slack connection error:",
        error,
      );

      setSlackMessage(
        "Unable to start Slack connection. Please try again.",
      );

      setSlackLoading(false);
    }
  };

  /* =======================================================
     SEARCH EMAILS WITH ELASTICSEARCH
  ======================================================= */

  const searchEmails = async (
    query: string,
  ) => {
    const token =
      localStorage.getItem(
        TOKEN_KEY,
      );

    if (!token) {
      return;
    }

    const trimmedQuery =
      query.trim();

    if (
      trimmedQuery.length <
      SEARCH_MIN_LENGTH
    ) {
      setSearchResults([]);

      setSearchError("");

      setSearchLoading(false);

      return;
    }

    try {
      setSearchLoading(true);

      setSearchError("");

      const response =
        await axios.get(
          `${API_URL}/api/search/emails`,
          {
            params: {
              q: trimmedQuery,
            },

            headers: {
              Authorization:
                `Bearer ${token}`,
            },
          },
        );

      const results =
        response.data.data ?? [];

      setSearchResults(results);

      setSearchOpen(true);

      setHealth((current) => ({
        ...current,
        search: "available",
      }));
    } catch (error) {
      console.error(
        "Email search failed:",
        error,
      );

      setSearchResults([]);

      setSearchError(
        "Search is temporarily unavailable.",
      );

      setHealth((current) => ({
        ...current,
        search: "unavailable",
      }));
    } finally {
      setSearchLoading(false);
    }
  };

  /* =======================================================
     SEARCH DEBOUNCE
  ======================================================= */

  useEffect(() => {
    const trimmedQuery =
      searchQuery.trim();

    if (
      trimmedQuery.length <
      SEARCH_MIN_LENGTH
    ) {
      setSearchResults([]);

      setSearchOpen(false);

      setSearchError("");

      return;
    }

    const timer =
      window.setTimeout(
        () => {
          void searchEmails(
            trimmedQuery,
          );
        },
        SEARCH_DEBOUNCE_MS,
      );

    return () => {
      window.clearTimeout(timer);
    };
  }, [searchQuery]);

  /* =======================================================
     SEARCH KEYBOARD HANDLING
  ======================================================= */

  const handleSearchKeyDown = (
    event: KeyboardEvent<HTMLInputElement>,
  ) => {
    if (event.key === "Escape") {
      setSearchOpen(false);

      setSearchQuery("");
    }

    if (
      event.key === "Enter" &&
      searchQuery.trim().length >=
        SEARCH_MIN_LENGTH
    ) {
      void searchEmails(
        searchQuery,
      );

      setSearchOpen(true);
    }
  };

  /* =======================================================
     SEARCH RESULT SELECTION
  ======================================================= */

  const handleSearchResultClick = (
    result: SearchResult,
  ) => {
    setSearchOpen(false);

    setSearchQuery("");

    if (result.status === "SENT") {
      setActiveSection("sent");
    } else {
      setActiveSection(
        "scheduled",
      );
    }
  };

  /* =======================================================
     CLEAR SEARCH
  ======================================================= */

  const clearSearch = () => {
    setSearchQuery("");

    setSearchResults([]);

    setSearchError("");

    setSearchOpen(false);
  };

  /* =======================================================
     LOCAL DATE FORMATTERS
     Used only inside DashboardPage itself.
  ======================================================= */

  const formatDate = (
    date: string | null,
  ) => {
    return formatDashboardDate(date);
  };

  const formatShortDate = (
    date: string | null,
  ) => {
    return formatDashboardShortDate(
      date,
    );
  };

  const formatTime = (
    date: string | null,
  ) => {
    return formatDashboardTime(date);
  };

  /* =======================================================
     FIRST NAME
  ======================================================= */

  const firstName = useMemo(() => {
    if (!user?.name) {
      return "there";
    }

    return (
      user.name
        .trim()
        .split(/\s+/)[0] ??
      "there"
    );
  }, [user]);

  /* =======================================================
     DELIVERY RATE
  ======================================================= */

  const deliveryRate = useMemo(() => {
    const total =
      stats.sent +
      stats.scheduled;

    if (total === 0) {
      return 0;
    }

    return Math.round(
      (stats.sent / total) *
        100,
    );
  }, [
    stats.sent,
    stats.scheduled,
  ]);

  /* =======================================================
     UPCOMING EMAIL
  ======================================================= */

  const nextScheduledEmail =
    useMemo(() => {
      if (
        scheduledEmails.length ===
        0
      ) {
        return null;
      }

      const sorted = [
        ...scheduledEmails,
      ].sort(
        (first, second) =>
          new Date(
            first.scheduledAt,
          ).getTime() -
          new Date(
            second.scheduledAt,
          ).getTime(),
      );

      return sorted[0] ?? null;
    }, [scheduledEmails]);

  /* =======================================================
     RECENT SENT EMAIL
  ======================================================= */

  const latestSentEmail =
    useMemo(() => {
      if (
        sentEmails.length === 0
      ) {
        return null;
      }

      const sorted = [
        ...sentEmails,
      ].sort(
        (first, second) => {
          const firstTime =
            first.sentAt
              ? new Date(
                  first.sentAt,
                ).getTime()
              : 0;

          const secondTime =
            second.sentAt
              ? new Date(
                  second.sentAt,
                ).getTime()
              : 0;

          return (
            secondTime -
            firstTime
          );
        },
      );

      return sorted[0] ?? null;
    }, [sentEmails]);

  /* =======================================================
     ACTIVITY FEED
  ======================================================= */

  const activityItems =
    useMemo<ActivityItem[]>(
      () => {
        const scheduledActivity =
          scheduledEmails
            .slice(0, 5)
            .map((email) => ({
              id:
                `scheduled-${email.id}`,
              title:
                email.recipientEmail,
              description:
                `Scheduled: ${email.subject}`,
              time:
                email.scheduledAt,
              type:
                "scheduled" as const,
            }));

        const sentActivity =
          sentEmails
            .slice(0, 5)
            .map((email) => ({
              id:
                `sent-${email.id}`,
              title:
                email.recipientEmail,
              description:
                `Sent: ${email.subject}`,
              time:
                email.sentAt ??
                new Date().toISOString(),
              type:
                "sent" as const,
            }));

        return [
          ...scheduledActivity,
          ...sentActivity,
        ]
          .sort(
            (first, second) =>
              new Date(
                second.time,
              ).getTime() -
              new Date(
                first.time,
              ).getTime(),
          )
          .slice(0, 8);
      },
      [
        scheduledEmails,
        sentEmails,
      ],
    );

  /* =======================================================
     QUICK ACTIONS
  ======================================================= */

  const quickActions =
    useMemo<QuickAction[]>(
      () => [
        {
          label: "New Campaign",
          description:
            "Schedule a new email campaign",
          icon: <Plus size={18} />,
          section: "compose",
        },

        {
          label:
            "Scheduled Emails",
          description:
            "Review upcoming deliveries",
          icon: (
            <CalendarClock
              size={18}
            />
          ),
          section: "scheduled",
        },

        {
          label: "Sent Emails",
          description:
            "View your delivery history",
          icon: (
            <Send size={18} />
          ),
          section: "sent",
        },

        {
          label: "Slack Alerts",
          description:
            "Configure delivery notifications",
          icon: (
            <MessageSquare
              size={18}
            />
          ),
          section: "slack",
        },
      ],
      [],
    );

  /* =======================================================
     LOADING SCREEN
  ======================================================= */

  if (loading) {
    return (
      <div className="reach-loading">
        <div className="reach-loader" />

        <div className="reach-loading-content">
          <div className="loading-brand-mark">
            <Mail size={20} />
          </div>

          <strong>
            ReachInbox
          </strong>

          <p>
            Loading your workspace...
          </p>
        </div>
      </div>
    );
  }

  /* =======================================================
     AUTH GUARD
  ======================================================= */

  if (!user) {
    return null;
  }

  /* =======================================================
     MAIN DASHBOARD
  ======================================================= */

  return (
    <div className="dashboard-shell">

      {/* ===================================================
          MOBILE OVERLAY
      =================================================== */}

      {mobileMenuOpen && (
        <button
          type="button"
          className="mobile-overlay"
          aria-label="Close navigation"
          onClick={() =>
            setMobileMenuOpen(false)
          }
        />
      )}

      {/* ===================================================
          SIDEBAR
      =================================================== */}

      <aside
        className={`dashboard-sidebar ${
          mobileMenuOpen
            ? "sidebar-open"
            : ""
        }`}
      >

        {/* =================================================
            SIDEBAR BRAND
        ================================================= */}

        <div className="sidebar-brand">

          <div className="sidebar-brand-mark">
            <Mail
              size={19}
              strokeWidth={2.4}
            />
          </div>

          <div className="sidebar-brand-content">
            <strong>
              ReachInbox
            </strong>

            <span>
              EMAIL OPERATIONS
            </span>
          </div>

          <button
            type="button"
            className="mobile-close-button"
            onClick={() =>
              setMobileMenuOpen(
                false,
              )
            }
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* =================================================
            WORKSPACE NAVIGATION
        ================================================= */}

        <nav className="sidebar-nav">

          <p className="nav-label">
            WORKSPACE
          </p>

          <button
            type="button"
            className={`nav-item ${
              activeSection ===
              "overview"
                ? "active"
                : ""
            }`}
            onClick={() =>
              handleNavigation(
                "overview",
              )
            }
          >
            <Activity size={18} />

            <span>
              Overview
            </span>
          </button>

          <button
            type="button"
            className={`nav-item ${
              activeSection ===
              "scheduled"
                ? "active"
                : ""
            }`}
            onClick={() =>
              handleNavigation(
                "scheduled",
              )
            }
          >
            <CalendarClock
              size={18}
            />

            <span>
              Scheduled Emails
            </span>

            {stats.scheduled >
              0 && (
              <span className="dashboard-count-badge">
                {stats.scheduled}
              </span>
            )}
          </button>

          <button
            type="button"
            className={`nav-item ${
              activeSection ===
              "sent"
                ? "active"
                : ""
            }`}
            onClick={() =>
              handleNavigation(
                "sent",
              )
            }
          >
            <Send size={18} />

            <span>
              Sent Emails
            </span>

            {stats.sent > 0 && (
              <span className="dashboard-count-badge">
                {stats.sent}
              </span>
            )}
          </button>

          {/* ===============================================
              CAMPAIGNS
          =============================================== */}

          <p className="nav-label nav-label-spaced">
            CAMPAIGNS
          </p>

          <button
            type="button"
            className={`nav-item ${
              activeSection ===
              "compose"
                ? "active"
                : ""
            }`}
            onClick={() =>
              handleNavigation(
                "compose",
              )
            }
          >
            <Plus size={18} />

            <span>
              New Campaign
            </span>
          </button>

          {/* ===============================================
              INTEGRATIONS
          =============================================== */}

          <p className="nav-label nav-label-spaced">
            INTEGRATIONS
          </p>

          <button
            type="button"
            className={`nav-item ${
              activeSection ===
              "slack"
                ? "active"
                : ""
            }`}
            onClick={() =>
              handleNavigation(
                "slack",
              )
            }
          >
            <MessageSquare
              size={18}
            />

            <span>
              Slack
            </span>

            {slackConnected && (
              <span className="integration-status-dot" />
            )}
          </button>
        </nav>

        {/* =================================================
            SIDEBAR BOTTOM
        ================================================= */}

        <div className="sidebar-bottom">

          <button
            type="button"
            className="nav-item sidebar-settings"
          >
            <Settings size={18} />

            <span>
              Settings
            </span>
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
                {user.name
                  .charAt(0)
                  .toUpperCase()}
              </div>
            )}

            <div className="sidebar-user-info">
              <strong>
                {user.name}
              </strong>

              <span>
                {user.email}
              </span>
            </div>

            <button
              type="button"
              className="sidebar-logout"
              onClick={
                handleLogout
              }
              title="Logout"
              aria-label="Logout"
            >
              <LogOut size={17} />
            </button>

          </div>
        </div>
      </aside>

      {/* ===================================================
          MAIN CONTENT
      =================================================== */}

      <main className="dashboard-main">

        {/* =================================================
            TOPBAR
        ================================================= */}

        <header className="dashboard-topbar">

          <button
            type="button"
            className="mobile-menu-button"
            onClick={() =>
              setMobileMenuOpen(
                true,
              )
            }
            aria-label="Open navigation"
          >
            <Menu size={22} />
          </button>

          <div className="topbar-title">

            <div className="topbar-heading-row">

              <span className="topbar-status-dot" />

              <h1>
                {activeSection ===
                  "overview" &&
                  "Overview"}

                {activeSection ===
                  "scheduled" &&
                  "Scheduled Emails"}

                {activeSection ===
                  "sent" &&
                  "Sent Emails"}

                {activeSection ===
                  "compose" &&
                  "New Campaign"}

                {activeSection ===
                  "slack" &&
                  "Slack Integration"}
              </h1>

            </div>

            <p>
              Manage your email campaigns
              and delivery workflow.
            </p>
          </div>

          {/* =================================================
              TOPBAR SEARCH
          ================================================= */}

          <div className="topbar-search-wrapper">

            <div
              className={`topbar-search ${
                searchFocused
                  ? "search-focused"
                  : ""
              }`}
            >

              <Search size={17} />

              <input
                type="search"
                value={searchQuery}
                placeholder="Search emails..."
                aria-label="Search emails"
                onFocus={() => {
                  setSearchFocused(
                    true,
                  );

                  if (
                    searchResults.length >
                    0
                  ) {
                    setSearchOpen(
                      true,
                    );
                  }
                }}
                onBlur={() => {
                  window.setTimeout(
                    () => {
                      setSearchFocused(
                        false,
                      );
                    },
                    150,
                  );
                }}
                onChange={(event) => {
                  setSearchQuery(
                    event.target.value,
                  );

                  setSearchOpen(
                    true,
                  );
                }}
                onKeyDown={
                  handleSearchKeyDown
                }
              />

              {searchLoading && (
                <RefreshCw
                  size={15}
                  className="dashboard-refresh-icon"
                />
              )}

              {!searchLoading &&
                searchQuery && (
                  <button
                    type="button"
                    className="search-clear-button"
                    onMouseDown={(
                      event,
                    ) => {
                      event.preventDefault();
                    }}
                    onClick={
                      clearSearch
                    }
                    aria-label="Clear search"
                  >
                    <X size={15} />
                  </button>
                )}

              {!searchQuery && (
                <span className="search-shortcut">
                  <Command size={12} />

                  K
                </span>
              )}
            </div>

            {/* =============================================
                SEARCH DROPDOWN
            ============================================= */}

            {searchOpen &&
              searchFocused && (
                <div className="search-dropdown">

                  {searchLoading ? (
                    <div className="search-dropdown-loading">

                      <RefreshCw
                        size={16}
                        className="dashboard-refresh-icon"
                      />

                      <span>
                        Searching your
                        email history...
                      </span>

                    </div>
                  ) : searchError ? (
                    <div className="search-dropdown-error">

                      <span>
                        {searchError}
                      </span>

                      <button
                        type="button"
                        onMouseDown={(
                          event,
                        ) => {
                          event.preventDefault();
                        }}
                        onClick={() =>
                          void searchEmails(
                            searchQuery,
                          )
                        }
                      >
                        Retry
                      </button>

                    </div>
                  ) : searchQuery.trim()
                      .length <
                    SEARCH_MIN_LENGTH ? (
                    <div className="search-dropdown-empty">

                      <Search
                        size={18}
                      />

                      <div>
                        <strong>
                          Search your
                          emails
                        </strong>

                        <span>
                          Type at least{" "}
                          {
                            SEARCH_MIN_LENGTH
                          }{" "}
                          characters.
                        </span>
                      </div>

                    </div>
                  ) : searchResults.length ===
                    0 ? (
                    <div className="search-dropdown-empty">

                      <FileText
                        size={20}
                      />

                      <div>
                        <strong>
                          No emails found
                        </strong>

                        <span>
                          Try another
                          recipient,
                          subject or
                          keyword.
                        </span>
                      </div>

                    </div>
                  ) : (
                    <>
                      <div className="search-dropdown-header">

                        <span>
                          SEARCH RESULTS
                        </span>

                        <strong>
                          {
                            searchResults.length
                          }
                        </strong>

                      </div>

                      <div className="search-results-list">

                        {searchResults
                          .slice(0, 6)
                          .map(
                            (
                              result,
                            ) => (
                              <button
                                type="button"
                                key={
                                  result.emailId
                                }
                                className="search-result-item"
                                onMouseDown={(
                                  event,
                                ) => {
                                  event.preventDefault();
                                }}
                                onClick={() =>
                                  handleSearchResultClick(
                                    result,
                                  )
                                }
                              >

                                <div className="search-result-icon">

                                  {result.status ===
                                  "SENT" ? (
                                    <Send
                                      size={
                                        15
                                      }
                                    />
                                  ) : (
                                    <Clock3
                                      size={
                                        15
                                      }
                                    />
                                  )}

                                </div>

                                <div className="search-result-content">

                                  <strong>
                                    {
                                      result.recipientEmail
                                    }
                                  </strong>

                                  <span>
                                    {
                                      result.subject
                                    }
                                  </span>

                                  <small>
                                    {result.status ===
                                    "SENT"
                                      ? `Sent ${formatDashboardDate(
                                          result.sentAt,
                                        )}`
                                      : `Scheduled ${formatDashboardDate(
                                          result.scheduledAt,
                                        )}`}
                                  </small>

                                </div>

                                <ChevronRight
                                  size={15}
                                />

                              </button>
                            ),
                          )}

                      </div>

                      <div className="search-dropdown-footer">

                        <span>
                          Powered by
                          Elasticsearch
                        </span>

                        <ExternalLink
                          size={12}
                        />

                      </div>
                    </>
                  )}

                </div>
              )}
          </div>

          {/* =================================================
              TOPBAR ACTIONS
          ================================================= */}

          <div className="topbar-actions">

            <button
              type="button"
              className="dashboard-refresh-button"
              onClick={() =>
                void handleRefresh()
              }
              title="Refresh dashboard"
              disabled={refreshing}
            >
              <RefreshCw
                size={16}
                className={
                  refreshing ||
                  dataLoading
                    ? "dashboard-refresh-icon"
                    : ""
                }
              />

              <span className="desktop-refresh-text">
                Refresh
              </span>
            </button>

            <button
              type="button"
              className="topbar-compose-button"
              onClick={() =>
                handleNavigation(
                  "compose",
                )
              }
            >
              <Plus size={17} />

              <span>
                New Email
              </span>
            </button>

          </div>
        </header>

        {/* =================================================
            DASHBOARD CONTENT
        ================================================= */}

        <div className="dashboard-content">

          {dataError && (
            <div className="dashboard-data-error">

              <div className="dashboard-error-message">

                <span className="error-indicator" />

                <span>
                  {dataError}
                </span>

              </div>

              <button
                type="button"
                className="dashboard-refresh-button"
                onClick={() =>
                  void handleRefresh()
                }
              >
                <RefreshCw size={15} />

                Retry
              </button>

            </div>
          )}

          {/* =================================================
              OVERVIEW
          ================================================= */}

          {activeSection ===
            "overview" && (
            <OverviewContent
              user={user}
              stats={stats}
              loading={dataLoading}
              scheduledEmails={
                scheduledEmails
              }
              sentEmails={
                sentEmails
              }
              activityItems={
                activityItems
              }
              deliveryRate={
                deliveryRate
              }
              nextScheduledEmail={
                nextScheduledEmail
              }
              latestSentEmail={
                latestSentEmail
              }
              health={health}
              lastUpdated={
                lastUpdated
              }
              quickActions={
                quickActions
              }
              onCompose={() =>
                handleNavigation(
                  "compose",
                )
              }
              onScheduled={() =>
                handleNavigation(
                  "scheduled",
                )
              }
              onSent={() =>
                handleNavigation(
                  "sent",
                )
              }
              onSlack={() =>
                handleNavigation(
                  "slack",
                )
              }
            />
          )}

          {/* =================================================
              SCHEDULED
          ================================================= */}

          {activeSection ===
            "scheduled" && (
            <ScheduledContent
              emails={
                scheduledEmails
              }
              loading={
                dataLoading
              }
              formatDate={
                formatDate
              }
              onCompose={() =>
                handleNavigation(
                  "compose",
                )
              }
              onRefresh={() =>
                void handleRefresh()
              }
            />
          )}

          {/* =================================================
              SENT
          ================================================= */}

          {activeSection ===
            "sent" && (
            <SentContent
              emails={sentEmails}
              loading={
                dataLoading
              }
              formatDate={
                formatDate
              }
              onRefresh={() =>
                void handleRefresh()
              }
            />
          )}

          {/* =================================================
              COMPOSE
          ================================================= */}

          {activeSection ===
            "compose" && (
            <ComposeContent
              onSuccess={() => {
                void loadDashboardData();

                handleNavigation(
                  "scheduled",
                );
              }}
            />
          )}

          {/* =================================================
              SLACK
          ================================================= */}

          {activeSection ===
            "slack" && (
            <SlackContent
              loading={
                slackLoading
              }
              message={
                slackMessage
              }
              connected={
                slackConnected
              }
              onConnect={
                handleSlackConnect
              }
            />
          )}

        </div>
      </main>
    </div>
  );
};

/* =========================================================
   END OF PART 1
========================================================= */
/* =========================================================
   OVERVIEW PROPS
========================================================= */

interface OverviewContentProps {
  user: User;

  stats: EmailStats;

  loading: boolean;

  scheduledEmails: ScheduledEmail[];

  sentEmails: SentEmail[];

  activityItems: ActivityItem[];

  deliveryRate: number;

  nextScheduledEmail:
    | ScheduledEmail
    | null;

  latestSentEmail:
    | SentEmail
    | null;

  health: DashboardHealth;

  lastUpdated: Date | null;

  quickActions: QuickAction[];

  onCompose: () => void;

  onScheduled: () => void;

  onSent: () => void;

  onSlack: () => void;
}

/* =========================================================
   OVERVIEW CONTENT
========================================================= */

const OverviewContent = ({
  user,
  stats,
  loading,
  scheduledEmails,
  sentEmails,
  activityItems,
  deliveryRate,
  nextScheduledEmail,
  latestSentEmail,
  health,
  lastUpdated,
  quickActions,
  onCompose,
  onScheduled,
  onSent,
  onSlack,
}: OverviewContentProps) => {
  return (
    <>
      {/* ===================================================
          WELCOME HERO
      =================================================== */}

      <section className="welcome-hero">
        <div className="welcome-copy">
          <div className="welcome-eyebrow">
            <Sparkles size={14} />

            <span>
              YOUR EMAIL WORKSPACE
            </span>
          </div>

          <h2>
            Welcome back,{" "}
            <span>
              {user.name
                .split(" ")[0]}
            </span>
          </h2>

          <p>
            Keep your campaigns organized,
            scheduled and moving efficiently
            from one workspace.
          </p>

          <div className="hero-meta">
            <span className="hero-live-indicator">
              <span />
              Workspace active
            </span>

            {lastUpdated && (
              <span>
                Updated{" "}
                {lastUpdated.toLocaleTimeString(
                  "en-IN",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}
              </span>
            )}
          </div>
        </div>

        <button
          type="button"
          className="hero-compose-button"
          onClick={onCompose}
        >
          <Plus size={18} />

          <span>
            Create Campaign
          </span>

          <ChevronRight size={17} />
        </button>
      </section>

      {/* ===================================================
          STATISTICS
      =================================================== */}

      <section className="stats-grid premium-stats">

        <StatCard
          icon={
            <Clock3 size={20} />
          }
          label="Scheduled"
          value={
            loading
              ? "..."
              : String(
                  stats.scheduled,
                )
          }
          description="Waiting for delivery"
          trend={
            nextScheduledEmail
              ? `Next ${new Date(
                  nextScheduledEmail.scheduledAt,
                ).toLocaleTimeString(
                  "en-IN",
                  {
                    hour: "2-digit",
                    minute: "2-digit",
                  },
                )}`
              : undefined
          }
          trendType="neutral"
        />

        <StatCard
          icon={
            <CheckCircle2
              size={20}
            />
          }
          label="Sent"
          value={
            loading
              ? "..."
              : String(
                  stats.sent,
                )
          }
          description="Successfully delivered"
          trend={
            deliveryRate > 0
              ? `${deliveryRate}% delivery activity`
              : undefined
          }
          trendType="positive"
        />

        <StatCard
          icon={
            <TrendingUp
              size={20}
            />
          }
          label="Campaigns"
          value={
            loading
              ? "..."
              : String(
                  stats.campaigns,
                )
          }
          description="Campaigns created"
          trend={
            stats.campaigns > 0
              ? "Workspace active"
              : undefined
          }
          trendType="neutral"
        />

        <StatCard
          icon={
            <Zap size={20} />
          }
          label="Delivery Signal"
          value={
            health.scheduler ===
            "active"
              ? "Live"
              : "Check"
          }
          description="Scheduler status"
          trend={
            health.api ===
              "online" &&
            health.search ===
              "available"
              ? "All systems ready"
              : "Needs attention"
          }
          trendType={
            health.api ===
              "online" &&
            health.search ===
              "available"
              ? "positive"
              : "neutral"
          }
        />

      </section>

      {/* ===================================================
          QUICK ACTIONS
      =================================================== */}

      <section className="quick-actions-section">

        <div className="section-heading-row">
          <div>
            <p className="section-kicker">
              WORKSPACE SHORTCUTS
            </p>

            <h3>
              Move faster
            </h3>
          </div>

          <span className="section-heading-description">
            Common actions for your
            email workflow.
          </span>
        </div>

        <div className="quick-actions-grid">

          {quickActions.map(
            (action) => (
              <button
                key={action.label}
                type="button"
                className="quick-action-card"
                onClick={() => {

                  if (
                    action.section ===
                    "compose"
                  ) {
                    onCompose();
                  }

                  if (
                    action.section ===
                    "scheduled"
                  ) {
                    onScheduled();
                  }

                  if (
                    action.section ===
                    "sent"
                  ) {
                    onSent();
                  }

                  if (
                    action.section ===
                    "slack"
                  ) {
                    onSlack();
                  }
                }}
              >
                <div className="quick-action-icon">
                  {action.icon}
                </div>

                <div className="quick-action-copy">
                  <strong>
                    {action.label}
                  </strong>

                  <span>
                    {action.description}
                  </span>
                </div>

                <ChevronRight
                  size={16}
                />
              </button>
            ),
          )}

        </div>
      </section>

      {/* ===================================================
          WORKSPACE INSIGHTS
      =================================================== */}

      <section className="insights-grid">

        {/* =================================================
            DELIVERY OVERVIEW
        ================================================= */}

        <div className="dashboard-panel delivery-panel">

          <div className="panel-header premium-panel-header">

            <div className="panel-title-group">

              <div className="panel-title-icon">
                <TrendingUp
                  size={17}
                />
              </div>

              <div>
                <h3>
                  Delivery overview
                </h3>

                <p>
                  A quick view of your
                  current email activity.
                </p>
              </div>

            </div>

          </div>

          <div className="delivery-overview">

            <div className="delivery-ring-wrapper">

              <div
                className="delivery-ring"
                style={{
                  background:
                    `conic-gradient(
                      currentColor ${
                        deliveryRate
                      }%,
                      rgba(15, 23, 42, 0.08) ${
                        deliveryRate
                      }%
                    )`,
                }}
              >

                <div className="delivery-ring-inner">

                  <strong>
                    {deliveryRate}%
                  </strong>

                  <span>
                    activity
                  </span>

                </div>

              </div>

            </div>

            <div className="delivery-breakdown">

              <div className="delivery-breakdown-item">

                <span className="delivery-dot scheduled-dot" />

                <div>
                  <strong>
                    {stats.scheduled}
                  </strong>

                  <span>
                    Scheduled
                  </span>
                </div>

              </div>

              <div className="delivery-breakdown-item">

                <span className="delivery-dot sent-dot" />

                <div>
                  <strong>
                    {stats.sent}
                  </strong>

                  <span>
                    Sent
                  </span>
                </div>

              </div>

              <div className="delivery-breakdown-item">

                <span className="delivery-dot campaign-dot" />

                <div>
                  <strong>
                    {stats.campaigns}
                  </strong>

                  <span>
                    Campaigns
                  </span>
                </div>

              </div>

            </div>
          </div>
        </div>

        {/* =================================================
            WORKSPACE HEALTH
        ================================================= */}

        <div className="dashboard-panel system-panel">

          <div className="panel-header premium-panel-header">

            <div className="panel-title-group">

              <div className="panel-title-icon">
                <Activity
                  size={17}
                />
              </div>

              <div>
                <h3>
                  Workspace health
                </h3>

                <p>
                  Core services supporting
                  your campaigns.
                </p>
              </div>

            </div>

          </div>

          <div className="health-list">

            <HealthRow
              label="API"
              value={
                health.api ===
                "online"
                  ? "Operational"
                  : "Unavailable"
              }
              status={
                health.api ===
                "online"
                  ? "online"
                  : "offline"
              }
            />

            <HealthRow
              label="Database"
              value={
                health.database ===
                "connected"
                  ? "Connected"
                  : "Unknown"
              }
              status={
                health.database ===
                "connected"
                  ? "online"
                  : "offline"
              }
            />

            <HealthRow
              label="Search"
              value={
                health.search ===
                "available"
                  ? "Elasticsearch ready"
                  : "Unavailable"
              }
              status={
                health.search ===
                "available"
                  ? "online"
                  : "offline"
              }
            />

            <HealthRow
              label="Scheduler"
              value={
                health.scheduler ===
                "active"
                  ? "Processing"
                  : "Unknown"
              }
              status={
                health.scheduler ===
                "active"
                  ? "online"
                  : "offline"
              }
            />

          </div>
        </div>

      </section>

      {/* ===================================================
          CAMPAIGN PULSE
      =================================================== */}

      <section className="dashboard-panel split-insight-panel">

        <div className="panel-header premium-panel-header">

          <div className="panel-title-group">

            <div className="panel-title-icon">
              <CalendarClock
                size={17}
              />
            </div>

            <div>
              <h3>
                Campaign pulse
              </h3>

              <p>
                Your next scheduled and
                most recent email.
              </p>
            </div>

          </div>

        </div>

        <div className="campaign-pulse-grid">

          {/* NEXT SCHEDULED */}

          <div className="pulse-card">

            <span className="pulse-label">
              NEXT SCHEDULED
            </span>

            {nextScheduledEmail ? (
              <>
                <strong>
                  {
                    nextScheduledEmail.recipientEmail
                  }
                </strong>

                <span>
                  {
                    nextScheduledEmail.subject
                  }
                </span>

                <small>
                  {formatDashboardShortDate(
                    nextScheduledEmail.scheduledAt,
                  )}{" "}
                  at{" "}
                  {formatDashboardTime(
                    nextScheduledEmail.scheduledAt,
                  )}
                </small>
              </>
            ) : (
              <>
                <strong>
                  Nothing scheduled
                </strong>

                <span>
                  Your queue is currently
                  clear.
                </span>
              </>
            )}

            <button
              type="button"
              className="inline-panel-action"
              onClick={onScheduled}
            >
              View schedule

              <ChevronRight
                size={14}
              />
            </button>

          </div>

          {/* MOST RECENT SENT */}

          <div className="pulse-card">

            <span className="pulse-label">
              MOST RECENT SENT
            </span>

            {latestSentEmail ? (
              <>
                <strong>
                  {
                    latestSentEmail.recipientEmail
                  }
                </strong>

                <span>
                  {
                    latestSentEmail.subject
                  }
                </span>

                <small>
                  {latestSentEmail.sentAt
                    ? formatDashboardDate(
                        latestSentEmail.sentAt,
                      )
                    : "Sent status available"}
                </small>
              </>
            ) : (
              <>
                <strong>
                  No sent emails yet
                </strong>

                <span>
                  Your delivery history
                  will appear here.
                </span>
              </>
            )}

            <button
              type="button"
              className="inline-panel-action"
              onClick={onSent}
            >
              View sent emails

              <ChevronRight
                size={14}
              />
            </button>

          </div>

        </div>
      </section>

      {/* ===================================================
          RECENT ACTIVITY
      =================================================== */}

      <section className="dashboard-panel activity-panel">

        <div className="panel-header premium-panel-header">

          <div className="panel-title-group">

            <div className="panel-title-icon">
              <Activity
                size={17}
              />
            </div>

            <div>
              <h3>
                Recent activity
              </h3>

              <p>
                The latest changes across
                your email workspace.
              </p>
            </div>

          </div>

          <span className="panel-header-count">
            {activityItems.length}
          </span>

        </div>

        {loading ? (
          <TableLoading rows={5} />
        ) : activityItems.length ===
          0 ? (
          <EmptyState
            icon={
              <Mail size={28} />
            }
            title="No email activity yet"
            description="Create your first campaign to start seeing activity here."
            actionLabel="Create Campaign"
            onAction={onCompose}
          />
        ) : (
          <div className="activity-list">

            {activityItems.map(
              (activity) => (
                <div
                  key={activity.id}
                  className="activity-item"
                >

                  <div
                    className={`activity-icon activity-icon-${activity.type}`}
                  >
                    {activity.type ===
                    "sent" ? (
                      <Send
                        size={15}
                      />
                    ) : activity.type ===
                      "scheduled" ? (
                      <Clock3
                        size={15}
                      />
                    ) : (
                      <TrendingUp
                        size={15}
                      />
                    )}
                  </div>

                  <div className="activity-copy">

                    <strong>
                      {activity.title}
                    </strong>

                    <span>
                      {
                        activity.description
                      }
                    </span>

                  </div>

                  <time>
                    {formatDashboardDate(
                      activity.time,
                    )}
                  </time>

                </div>
              ),
            )}

          </div>
        )}

      </section>

      {/* ===================================================
          SMART TIP
      =================================================== */}

      <section className="smart-tip-card">

        <div className="smart-tip-icon">
          <Sparkles
            size={18}
          />
        </div>

        <div className="smart-tip-content">

          <span>
            SMART TIP
          </span>

          <strong>
            Keep your campaigns organized
          </strong>

          <p>
            Use the scheduler and delivery
            controls to manage larger email
            campaigns without losing visibility.
          </p>

        </div>

        <button
          type="button"
          onClick={onCompose}
          className="smart-tip-action"
        >
          Create campaign

          <ChevronRight
            size={15}
          />
        </button>

      </section>
    </>
  );
};

/* =========================================================
   HEALTH ROW
========================================================= */

interface HealthRowProps {
  label: string;
  value: string;
  status:
    | "online"
    | "offline";
}

const HealthRow = ({
  label,
  value,
  status,
}: HealthRowProps) => {
  return (
    <div className="health-row">

      <div className="health-row-left">

        <span
          className={`health-status-dot ${
            status === "online"
              ? "health-online"
              : "health-offline"
          }`}
        />

        <span className="health-label">
          {label}
        </span>

      </div>

      <span
        className={`health-value ${
          status === "online"
            ? "health-value-online"
            : "health-value-offline"
        }`}
      >
        {value}
      </span>

    </div>
  );
};

/* =========================================================
   STAT CARD
========================================================= */

const StatCard = ({
  icon,
  label,
  value,
  description,
  trend,
  trendType = "neutral",
}: StatCardProps) => {
  return (
    <div className="stat-card">

      <div className="stat-card-top">

        <div className="stat-card-icon">
          {icon}
        </div>

        {trend && (
          <span
            className={`stat-trend ${
              trendType ===
              "positive"
                ? "stat-trend-positive"
                : "stat-trend-neutral"
            }`}
          >
            {trend}
          </span>
        )}

      </div>

      <div className="stat-card-value">
        {value}
      </div>

      <div className="stat-card-label">
        {label}
      </div>

      <div className="stat-card-description">
        {description}
      </div>

    </div>
  );
};

/* =========================================================
   STATUS BADGE
========================================================= */

const StatusBadge = ({
  status,
}: StatusBadgeProps) => {

  const normalizedStatus =
    status
      .trim()
      .toLowerCase();

  const isSent =
    normalizedStatus ===
      "sent" ||
    normalizedStatus ===
      "success";

  const isFailed =
    normalizedStatus ===
      "failed" ||
    normalizedStatus ===
      "failure";

  const isProcessing =
    normalizedStatus ===
      "processing";

  const isCancelled =
    normalizedStatus ===
      "cancelled";

  let label = "Scheduled";

  if (isSent) {
    label = "Sent";
  } else if (isFailed) {
    label = "Failed";
  } else if (isProcessing) {
    label = "Processing";
  } else if (isCancelled) {
    label = "Cancelled";
  }

  return (
    <span
      className={`status-badge status-${normalizedStatus}`}
    >

      <span className="status-badge-dot" />

      {label}

    </span>
  );
};

/* =========================================================
   TABLE LOADING
========================================================= */

const TableLoading = ({
  rows = 5,
}: TableLoadingProps) => {
  return (
    <div className="table-loading">

      {Array.from({
        length: rows,
      }).map((_, index) => (
        <div
          key={index}
          className="table-loading-row"
        >
          <div className="loading-skeleton loading-skeleton-wide" />

          <div className="loading-skeleton loading-skeleton-medium" />

          <div className="loading-skeleton loading-skeleton-small" />

          <div className="loading-skeleton loading-skeleton-status" />
        </div>
      ))}

    </div>
  );
};

/* =========================================================
   EMPTY STATE
========================================================= */

const EmptyState = ({
  icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) => {
  return (
    <div className="empty-state">

      <div className="empty-state-icon">
        {icon}
      </div>

      <h3>
        {title}
      </h3>

      <p>
        {description}
      </p>

      {actionLabel &&
        onAction && (
          <button
            type="button"
            className="empty-state-action"
            onClick={onAction}
          >
            <Plus size={16} />

            {actionLabel}
          </button>
        )}

    </div>
  );
};

/* =========================================================
   END OF PART 2
========================================================= */
/* =========================================================
   SCHEDULED EMAILS
========================================================= */

interface ScheduledContentProps {
  emails: ScheduledEmail[];
  loading: boolean;
  formatDate: (
    date: string | null,
  ) => string;
  onCompose: () => void;
  onRefresh: () => void;
}

const ScheduledContent = ({
  emails,
  loading,
  formatDate,
  onCompose,
  onRefresh,
}: ScheduledContentProps) => {
  return (
    <>
      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <section className="content-page-header">

        <div>
          <div className="content-eyebrow">
            <Clock3 size={14} />

            <span>
              DELIVERY QUEUE
            </span>
          </div>

          <h2>
            Scheduled Emails
          </h2>

          <p>
            Review emails waiting for
            delivery and their scheduled
            send times.
          </p>
        </div>

        <div className="content-header-actions">

          <button
            type="button"
            className="secondary-action-button"
            onClick={onRefresh}
          >
            <RefreshCw
              size={15}
            />

            Refresh
          </button>

          <button
            type="button"
            className="primary-action-button"
            onClick={onCompose}
          >
            <Plus size={16} />

            New Campaign
          </button>

        </div>
      </section>

      {/* ===================================================
          SUMMARY
      =================================================== */}

      <div className="list-summary-row">

        <div className="list-summary-item">
          <span>
            Scheduled
          </span>

          <strong>
            {loading
              ? "..."
              : emails.length}
          </strong>
        </div>

        <div className="list-summary-item">
          <span>
            Queue status
          </span>

          <strong>
            {emails.length > 0
              ? "Active"
              : "Clear"}
          </strong>
        </div>

      </div>

      {/* ===================================================
          TABLE
      =================================================== */}

      <section className="dashboard-panel email-table-panel">

        <div className="panel-header premium-panel-header">

          <div className="panel-title-group">

            <div className="panel-title-icon">
              <CalendarClock
                size={17}
              />
            </div>

            <div>
              <h3>
                Upcoming deliveries
              </h3>

              <p>
                Emails currently stored in
                your scheduling queue.
              </p>
            </div>

          </div>

          <span className="panel-header-count">
            {emails.length}
          </span>

        </div>

        {loading ? (
          <TableLoading rows={6} />
        ) : emails.length ===
          0 ? (
          <EmptyState
            icon={
              <CalendarClock
                size={28}
              />
            }
            title="No scheduled emails"
            description="You don't have any emails waiting for delivery. Create a campaign to get started."
            actionLabel="Create Campaign"
            onAction={onCompose}
          />
        ) : (
          <div className="email-table-wrapper">

            <table className="email-table">

              <thead>
                <tr>
                  <th>
                    Recipient
                  </th>

                  <th>
                    Subject
                  </th>

                  <th>
                    Scheduled time
                  </th>

                  <th>
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>

                {emails.map(
                  (email) => (
                    <tr
                      key={email.id}
                    >

                      <td>
                        <div className="recipient-cell">

                          <div className="recipient-avatar">
                            {email.recipientEmail
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {
                                email.recipientName ||
                                email.recipientEmail
                              }
                            </strong>

                            <span>
                              {
                                email.recipientEmail
                              }
                            </span>
                          </div>

                        </div>
                      </td>

                      <td>
                        <div className="subject-cell">
                          <strong>
                            {email.subject}
                          </strong>

                          <span>
                            Scheduled delivery
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="date-cell">
                          <strong>
                            {formatDate(
                              email.scheduledAt,
                            )}
                          </strong>

                          <span>
                            Local time
                          </span>
                        </div>
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            email.status
                          }
                        />
                      </td>

                    </tr>
                  ),
                )}

              </tbody>

            </table>

          </div>
        )}

      </section>

      {/* ===================================================
          INFORMATION NOTICE
      =================================================== */}

      <DashboardNotice
        icon={
          <Clock3 size={17} />
        }
        title="Scheduled emails remain persistent"
        description="Your scheduled emails are stored in PostgreSQL and processed through the BullMQ scheduler."
      />
    </>
  );
};

/* =========================================================
   SENT EMAILS
========================================================= */

interface SentContentProps {
  emails: SentEmail[];
  loading: boolean;
  formatDate: (
    date: string | null,
  ) => string;
  onRefresh: () => void;
}

const SentContent = ({
  emails,
  loading,
  formatDate,
  onRefresh,
}: SentContentProps) => {
  const sentCount =
    emails.filter(
      (email) =>
        email.status === "SENT",
    ).length;

  const failedCount =
    emails.filter(
      (email) =>
        email.status === "FAILED",
    ).length;

  return (
    <>
      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <section className="content-page-header">

        <div>
          <div className="content-eyebrow">
            <Send size={14} />

            <span>
              DELIVERY HISTORY
            </span>
          </div>

          <h2>
            Sent Emails
          </h2>

          <p>
            Track your completed and failed
            email deliveries.
          </p>
        </div>

        <div className="content-header-actions">

          <button
            type="button"
            className="secondary-action-button"
            onClick={onRefresh}
          >
            <RefreshCw
              size={15}
            />

            Refresh
          </button>

        </div>

      </section>

      {/* ===================================================
          SENT SUMMARY
      =================================================== */}

      <section className="campaign-metrics-grid">

        <CampaignMetric
          icon={
            <CheckCircle2
              size={18}
            />
          }
          label="Delivered"
          value={
            loading
              ? "..."
              : String(sentCount)
          }
          description="Successfully sent"
        />

        <CampaignMetric
          icon={
            <Send size={18} />
          }
          label="Total history"
          value={
            loading
              ? "..."
              : String(
                  emails.length,
                )
          }
          description="Recorded deliveries"
        />

        <CampaignMetric
          icon={
            <X size={18} />
          }
          label="Failed"
          value={
            loading
              ? "..."
              : String(failedCount)
          }
          description="Delivery failures"
        />

      </section>

      {/* ===================================================
          TABLE
      =================================================== */}

      <section className="dashboard-panel email-table-panel">

        <div className="panel-header premium-panel-header">

          <div className="panel-title-group">

            <div className="panel-title-icon">
              <Send size={17} />
            </div>

            <div>
              <h3>
                Delivery history
              </h3>

              <p>
                A record of your email
                delivery activity.
              </p>
            </div>

          </div>

          <span className="panel-header-count">
            {emails.length}
          </span>

        </div>

        {loading ? (
          <TableLoading rows={6} />
        ) : emails.length ===
          0 ? (
          <EmptyState
            icon={
              <Send size={28} />
            }
            title="No sent emails yet"
            description="Once your scheduled emails are delivered, they'll appear here."
          />
        ) : (
          <div className="email-table-wrapper">

            <table className="email-table">

              <thead>
                <tr>
                  <th>
                    Recipient
                  </th>

                  <th>
                    Subject
                  </th>

                  <th>
                    Sent time
                  </th>

                  <th>
                    Status
                  </th>
                </tr>
              </thead>

              <tbody>

                {emails.map(
                  (email) => (
                    <tr
                      key={email.id}
                    >

                      <td>
                        <div className="recipient-cell">

                          <div className="recipient-avatar">
                            {email.recipientEmail
                              .charAt(0)
                              .toUpperCase()}
                          </div>

                          <div>
                            <strong>
                              {
                                email.recipientName ||
                                email.recipientEmail
                              }
                            </strong>

                            <span>
                              {
                                email.recipientEmail
                              }
                            </span>
                          </div>

                        </div>
                      </td>

                      <td>
                        <div className="subject-cell">
                          <strong>
                            {email.subject}
                          </strong>

                          <span>
                            Email delivery
                          </span>
                        </div>
                      </td>

                      <td>
                        <div className="date-cell">

                          <strong>
                            {formatDate(
                              email.sentAt,
                            )}
                          </strong>

                          <span>
                            Delivery time
                          </span>

                        </div>
                      </td>

                      <td>
                        <StatusBadge
                          status={
                            email.status
                          }
                        />
                      </td>

                    </tr>
                  ),
                )}

              </tbody>

            </table>

          </div>
        )}

      </section>

      <DashboardNotice
        icon={
          <Search size={17} />
        }
        title="Search your delivery history"
        description="Use the Elasticsearch-powered search box in the dashboard header to find recipients, subjects and email content."
      />
    </>
  );
};

/* =========================================================
   COMPOSE CONTENT
========================================================= */

interface ComposeContentProps {
  onSuccess: () => void;
}

const ComposeContent = ({
  onSuccess,
}: ComposeContentProps) => {
  return (
    <>
      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <section className="content-page-header">

        <div>
          <div className="content-eyebrow">
            <Plus size={14} />

            <span>
              CAMPAIGN BUILDER
            </span>
          </div>

          <h2>
            New Campaign
          </h2>

          <p>
            Create a scheduled email campaign
            and control its delivery rate.
          </p>
        </div>

      </section>

      {/* ===================================================
          CAMPAIGN BUILDER
      =================================================== */}

      <section className="compose-layout">

        <div className="compose-main-card">

          <div className="compose-card-header">

            <div className="compose-card-icon">
              <Mail size={19} />
            </div>

            <div>
              <h3>
                Compose your campaign
              </h3>

              <p>
                Add your message, recipients
                and delivery settings.
              </p>
            </div>

          </div>

          <div className="compose-form-wrapper">

            <ComposeEmailForm />

          </div>

        </div>

        {/* =================================================
            CAMPAIGN GUIDANCE
        ================================================= */}

        <aside className="compose-side-column">

          <div className="dashboard-panel compose-guide-panel">

            <div className="panel-header premium-panel-header">

              <div className="panel-title-group">

                <div className="panel-title-icon">
                  <Sparkles
                    size={17}
                  />
                </div>

                <div>
                  <h3>
                    Campaign guide
                  </h3>

                  <p>
                    A few things to keep
                    in mind.
                  </p>
                </div>
              </div>

            </div>

            <div className="guide-list">

              <div className="guide-item">

                <span className="guide-number">
                  01
                </span>

                <div>
                  <strong>
                    Upload recipients
                  </strong>

                  <p>
                    Import your leads from
                    the supported file format.
                  </p>
                </div>

              </div>

              <div className="guide-item">

                <span className="guide-number">
                  02
                </span>

                <div>
                  <strong>
                    Choose timing
                  </strong>

                  <p>
                    Set a future start time
                    for your campaign.
                  </p>
                </div>

              </div>

              <div className="guide-item">

                <span className="guide-number">
                  03
                </span>

                <div>
                  <strong>
                    Control delivery
                  </strong>

                  <p>
                    Configure delay and
                    hourly sending limits.
                  </p>
                </div>

              </div>

              <div className="guide-item">

                <span className="guide-number">
                  04
                </span>

                <div>
                  <strong>
                    Monitor results
                  </strong>

                  <p>
                    Track scheduled and sent
                    emails from your dashboard.
                  </p>
                </div>

              </div>

            </div>

          </div>

          <div className="dashboard-panel compose-reliability-panel">

            <div className="reliability-icon">
              <CheckCircle2
                size={19}
              />
            </div>

            <div>
              <strong>
                Reliable scheduling
              </strong>

              <p>
                Campaigns are persisted before
                they enter the delivery queue.
              </p>
            </div>

          </div>

        </aside>

      </section>

      {/* ===================================================
          COMPOSE FOOTER NOTICE
      =================================================== */}

      <DashboardNotice
        icon={
          <Zap size={17} />
        }
        title="Built for controlled delivery"
        description="Your campaign settings determine the spacing and hourly sending capacity used by the backend scheduler."
      />
    </>
  );
};

/* =========================================================
   SLACK CONTENT
========================================================= */

interface SlackContentProps {
  loading: boolean;
  message: string;
  connected: boolean;
  onConnect: () => void;
}

const SlackContent = ({
  loading,
  message,
  connected,
  onConnect,
}: SlackContentProps) => {
  return (
    <>
      {/* ===================================================
          PAGE HEADER
      =================================================== */}

      <section className="content-page-header">

        <div>
          <div className="content-eyebrow">
            <MessageSquare
              size={14}
            />

            <span>
              INTEGRATIONS
            </span>
          </div>

          <h2>
            Slack Integration
          </h2>

          <p>
            Receive notifications when your
            email sending limit is reached.
          </p>
        </div>

      </section>

      {/* ===================================================
          SLACK HERO
      =================================================== */}

      <section className="slack-hero-card">

        <div className="slack-hero-content">

          <div className="slack-brand-icon">
            <MessageSquare
              size={28}
            />
          </div>

          <div>

            <div className="slack-status-label">

              <span
                className={
                  connected
                    ? "slack-connected-dot"
                    : "slack-disconnected-dot"
                }
              />

              {connected
                ? "Connected"
                : "Not connected"}

            </div>

            <h3>
              Stay informed about
              campaign limits
            </h3>

            <p>
              Connect Slack to receive a
              notification when your hourly
              sending limit is reached.
            </p>

          </div>

        </div>

        <button
          type="button"
          className={
            connected
              ? "slack-connected-button"
              : "slack-connect-button"
          }
          onClick={onConnect}
          disabled={
            loading ||
            connected
          }
        >
          {loading ? (
            <>
              <RefreshCw
                size={16}
                className="dashboard-refresh-icon"
              />

              Connecting...
            </>
          ) : connected ? (
            <>
              <CheckCircle2
                size={16}
              />

              Slack Connected
            </>
          ) : (
            <>
              <MessageSquare
                size={16}
              />

              Connect Slack
            </>
          )}
        </button>

      </section>

      {/* ===================================================
          MESSAGE
      =================================================== */}

      {message && (
        <div
          className={`slack-feedback ${
            message
              .toLowerCase()
              .includes("unable")
              ? "slack-feedback-error"
              : "slack-feedback-success"
          }`}
        >
          {message}
        </div>
      )}

      {/* ===================================================
          SLACK FEATURES
      =================================================== */}

      <section className="slack-feature-grid">

        <div className="dashboard-panel slack-feature-card">

          <div className="slack-feature-icon">
            <Zap size={18} />
          </div>

          <h3>
            Hourly limit alerts
          </h3>

          <p>
            Get notified when your configured
            hourly email capacity is reached.
          </p>

        </div>

        <div className="dashboard-panel slack-feature-card">

          <div className="slack-feature-icon">
            <Activity size={18} />
          </div>

          <h3>
            Delivery visibility
          </h3>

          <p>
            Stay aware of delivery throttling
            without continuously watching the
            dashboard.
          </p>

        </div>

        <div className="dashboard-panel slack-feature-card">

          <div className="slack-feature-icon">
            <CheckCircle2
              size={18}
            />
          </div>

          <h3>
            Safe connection
          </h3>

          <p>
            Slack notifications are optional.
            Email scheduling continues normally
            when Slack is not connected.
          </p>

        </div>

      </section>

      {/* ===================================================
          HOW IT WORKS
      =================================================== */}

      <section className="dashboard-panel slack-how-panel">

        <div className="panel-header premium-panel-header">

          <div className="panel-title-group">

            <div className="panel-title-icon">
              <Command
                size={17}
              />
            </div>

            <div>
              <h3>
                How it works
              </h3>

              <p>
                Slack notifications are
                triggered by the backend rate
                limiter.
              </p>
            </div>

          </div>

        </div>

        <div className="slack-flow">

          <div className="slack-flow-step">
            <span>
              01
            </span>

            <strong>
              Campaign sends
            </strong>

            <p>
              Emails are processed through the
              BullMQ worker.
            </p>
          </div>

          <ChevronRight
            size={18}
            className="slack-flow-arrow"
          />

          <div className="slack-flow-step">
            <span>
              02
            </span>

            <strong>
              Limit reached
            </strong>

            <p>
              Redis-backed rate limiting delays
              the next available email.
            </p>
          </div>

          <ChevronRight
            size={18}
            className="slack-flow-arrow"
          />

          <div className="slack-flow-step">
            <span>
              03
            </span>

            <strong>
              Slack alert
            </strong>

            <p>
              Slack receives the hourly-limit
              notification.
            </p>
          </div>

        </div>

      </section>
    </>
  );
};

/* =========================================================
   SEARCH RESULT PREVIEW
========================================================= */

interface SearchResultPreviewProps {
  result: SearchResult;
  onOpen: () => void;
}

const SearchResultPreview = ({
  result,
  onOpen,
}: SearchResultPreviewProps) => {
  return (
    <button
      type="button"
      className="search-result-preview"
      onClick={onOpen}
    >

      <div className="search-preview-icon">

        {result.status ===
        "SENT" ? (
          <Send size={16} />
        ) : (
          <Clock3 size={16} />
        )}

      </div>

      <div className="search-preview-content">

        <strong>
          {result.recipientEmail}
        </strong>

        <span>
          {result.subject}
        </span>

        <small>
          {result.status ===
          "SENT"
            ? "Sent email"
            : "Scheduled email"}
        </small>

      </div>

      <ChevronRight
        size={16}
      />

    </button>
  );
};

/* =========================================================
   SEARCH EMPTY STATE
========================================================= */

interface SearchEmptyStateProps {
  query: string;
}

const SearchEmptyState = ({
  query,
}: SearchEmptyStateProps) => {
  return (
    <div className="search-empty-state">

      <div className="search-empty-icon">
        <Search size={20} />
      </div>

      <strong>
        No matching emails
      </strong>

      <p>
        No email matched "
        {query}
        ".
      </p>

    </div>
  );
};

/* =========================================================
   CAMPAIGN METRIC
========================================================= */

interface CampaignMetricProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  description: string;
}

const CampaignMetric = ({
  icon,
  label,
  value,
  description,
}: CampaignMetricProps) => {
  return (
    <div className="campaign-metric-card">

      <div className="campaign-metric-icon">
        {icon}
      </div>

      <div className="campaign-metric-copy">

        <span>
          {label}
        </span>

        <strong>
          {value}
        </strong>

        <small>
          {description}
        </small>

      </div>

    </div>
  );
};

/* =========================================================
   EMAIL PREVIEW CARD
========================================================= */

interface EmailPreviewCardProps {
  email: {
    recipientEmail: string;
    recipientName?: string | null;
    subject: string;
    body?: string;
    status: string;
    scheduledAt?: string;
    sentAt?: string | null;
  };
}

const EmailPreviewCard = ({
  email,
}: EmailPreviewCardProps) => {
  return (
    <div className="email-preview-card">

      <div className="email-preview-header">

        <div className="email-preview-avatar">
          {email.recipientEmail
            .charAt(0)
            .toUpperCase()}
        </div>

        <div>
          <strong>
            {email.recipientName ||
              email.recipientEmail}
          </strong>

          <span>
            {email.recipientEmail}
          </span>
        </div>

        <StatusBadge
          status={email.status}
        />

      </div>

      <div className="email-preview-subject">
        {email.subject}
      </div>

      {email.body && (
        <p className="email-preview-body">
          {email.body}
        </p>
      )}

    </div>
  );
};

/* =========================================================
   DASHBOARD NOTICE
========================================================= */

interface DashboardNoticeProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

const DashboardNotice = ({
  icon,
  title,
  description,
}: DashboardNoticeProps) => {
  return (
    <div className="dashboard-notice">

      <div className="dashboard-notice-icon">
        {icon}
      </div>

      <div className="dashboard-notice-content">

        <strong>
          {title}
        </strong>

        <p>
          {description}
        </p>

      </div>

    </div>
  );
};

/* =========================================================
   DASHBOARD FOOTER
========================================================= */

const DashboardFooter = () => {
  return (
    <footer className="dashboard-footer">

      <div className="dashboard-footer-brand">

        <div className="dashboard-footer-mark">
          <Mail size={14} />
        </div>

        <span>
          ReachInbox
        </span>

      </div>

      <div className="dashboard-footer-meta">
        Email operations workspace
      </div>

    </footer>
  );
};

/* =========================================================
   FINAL EXPORT
========================================================= */

export default DashboardPage;