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

export const api = {
  login: (userId, password) =>
    fetch(`${BASE}/auth/login`, { method: "POST", headers: headers(), body: JSON.stringify({ userId, password }) }).then(handle),

  getMenu: () =>
    fetch(`${BASE}/menu`, { headers: headers() }).then(handle),

  updateMenu: (day, meals) =>
    fetch(`${BASE}/menu/${day}`, { method: "PUT", headers: headers(), body: JSON.stringify(meals) }).then(handle),

  setDefaultFood: (day, meal, diet, index) =>
    fetch(`${BASE}/menu/${day}/default`, { method: "PUT", headers: headers(), body: JSON.stringify({ meal, diet, index }) }).then(handle),

  getPreferences: () =>
    fetch(`${BASE}/preferences`, { headers: headers() }).then(handle),

  setPreference: (day, meal, choiceIndex, diet) =>
    fetch(`${BASE}/preferences`, { method: "PUT", headers: headers(), body: JSON.stringify({ day, meal, choiceIndex, diet }) }).then(handle),

  getAnalytics: () =>
    fetch(`${BASE}/preferences/analytics`, { headers: headers() }).then(handle),

  getDietSummary: () =>
    fetch(`${BASE}/preferences/diet-summary`, { headers: headers() }).then(handle),

  getWindow: () =>
    fetch(`${BASE}/preferences/window`, { headers: headers() }).then(handle),

  getLeave: () =>
    fetch(`${BASE}/leave`, { headers: headers() }).then(handle),

  toggleLeave: (date) =>
    fetch(`${BASE}/leave/toggle`, { method: "POST", headers: headers(), body: JSON.stringify({ date }) }).then(handle),

  getLeaveSummary: () =>
    fetch(`${BASE}/leave/summary`, { headers: headers() }).then(handle),

  getStats: () =>
    fetch(`${BASE}/stats`, { headers: headers() }).then(handle),

  getNotifications: () =>
    fetch(`${BASE}/stats/notifications`, { headers: headers() }).then(handle),
};
