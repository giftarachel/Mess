const BASE = import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : "/api";

const getToken = () => localStorage.getItem("ll_token") || localStorage.getItem("messiq_token");

const headers = () => ({
  "Content-Type": "application/json",
  ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
});

const handle = async (res) => {
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) throw new Error(data.message || "Request failed");
  return data;
};

const fetchWithRetry = async (url, options = {}, retries = 2) => {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { ...options, signal: AbortSignal.timeout(15000) });
      return await handle(res);
    } catch (e) {
      if (i === retries)
        throw new Error(
          e.message === "Failed to fetch"
            ? "Server is waking up, please try again in a moment."
            : e.message
        );
      await new Promise(r => setTimeout(r, 3000));
    }
  }
};

export const api = {
  // Auth
  login: (userId, password) =>
    fetchWithRetry(`${BASE}/auth/login`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ userId, password }),
    }),

  // Menu — breakfast only
  getMenu: () =>
    fetch(`${BASE}/menu`, { headers: headers() }).then(handle),

  updateMenu: (day, breakfast) =>
    fetch(`${BASE}/menu/${day}`, {
      method: "PUT", headers: headers(),
      body: JSON.stringify({ Breakfast: breakfast }),
    }).then(handle),

  setDefaultFood: (day, diet, index) =>
    fetch(`${BASE}/menu/${day}/default`, {
      method: "PUT", headers: headers(),
      body: JSON.stringify({ diet, index }),
    }).then(handle),

  setSlot: (day, slotVeg, slotNonVeg) =>
    fetch(`${BASE}/menu/${day}/slot`, {
      method: "PUT", headers: headers(),
      body: JSON.stringify({ slotVeg, slotNonVeg }),
    }).then(handle),

  setStock: (day, stockVeg, stockNonVeg) =>
    fetch(`${BASE}/menu/${day}/stock`, {
      method: "PUT", headers: headers(),
      body: JSON.stringify({ stockVeg, stockNonVeg }),
    }).then(handle),

  // Preferences — one breakfast per day
  getPreferences: () =>
    fetch(`${BASE}/preferences`, { headers: headers() }).then(handle),

  setPreference: (day, choiceIndex, diet) =>
    fetch(`${BASE}/preferences`, {
      method: "PUT", headers: headers(),
      body: JSON.stringify({ day, choiceIndex, diet }),
    }).then(handle),

  getAnalytics: () =>
    fetch(`${BASE}/preferences/analytics`, { headers: headers() }).then(handle),

  getDietSummary: () =>
    fetch(`${BASE}/preferences/diet-summary`, { headers: headers() }).then(handle),

  getWindow: () =>
    fetch(`${BASE}/preferences/window`, { headers: headers() }).then(handle),

  // Leave
  getLeave: () =>
    fetch(`${BASE}/leave`, { headers: headers() }).then(handle),

  toggleLeave: (date) =>
    fetch(`${BASE}/leave/toggle`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ date }),
    }).then(handle),

  // Stats
  getStats: () =>
    fetch(`${BASE}/stats`, { headers: headers() }).then(handle),

  getNotifications: () =>
    fetch(`${BASE}/stats/notifications`, { headers: headers() }).then(handle),

  // Feedback
  submitFeedback: (meal, rating, comment) =>
    fetch(`${BASE}/feedback`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ meal, rating, comment }),
    }).then(handle),

  getFeedback: () =>
    fetch(`${BASE}/feedback`, { headers: headers() }).then(handle),

  getFeedbackSummary: () =>
    fetch(`${BASE}/feedback/summary`, { headers: headers() }).then(handle),

  // Notifications
  getNotifications: () =>
    fetch(`${BASE}/notifications`, { headers: headers() }).then(handle),

  markRead: (id) =>
    fetch(`${BASE}/notifications/${id}/read`, { method: "POST", headers: headers() }).then(handle),

  markAllRead: () =>
    fetch(`${BASE}/notifications/read-all`, { method: "POST", headers: headers() }).then(handle),

  broadcastNotification: (title, message, targetRole = "all") =>
    fetch(`${BASE}/notifications/broadcast`, {
      method: "POST", headers: headers(),
      body: JSON.stringify({ title, message, targetRole }),
    }).then(handle),

  getDeadline: () =>
    fetch(`${BASE}/preferences/deadline`, { headers: headers() }).then(handle),

  // SSE stream — returns EventSource URL (used directly in frontend)
  getSSEUrl: () => `${BASE}/notifications/stream`,

  // Smart Preparation Recommendation
  getSmartPrepRecommendations: (day) =>
    fetch(`${BASE}/smartprep/recommendations${day ? `?day=${day}` : ""}`, { headers: headers() }).then(handle),

  confirmPrepPlan: (data) =>
    fetch(`${BASE}/smartprep/confirm`, {
      method: "POST", headers: headers(),
      body: JSON.stringify(data),
    }).then(handle),

  getSmartPrepHistory: () =>
    fetch(`${BASE}/smartprep/history`, { headers: headers() }).then(handle),

  getSmartPrepSummary: () =>
    fetch(`${BASE}/smartprep/summary`, { headers: headers() }).then(handle),
};
