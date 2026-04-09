import axios from "axios";

const ACCESS_TOKEN_KEY = "access_token";

function clearClientAccessTokenCookie() {
  if (typeof document === "undefined") return;
  document.cookie = `${ACCESS_TOKEN_KEY}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function resolveApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }
  if (typeof window !== "undefined" && window.location.hostname === "127.0.0.1") {
    return "http://127.0.0.1:8000";
  }
  return "http://localhost:8000";
}

export const api = axios.create({
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  config.baseURL = resolveApiBaseUrl();
  const method = String(config.method || "get").toLowerCase();
  const path = String(config.url || "").replace(/\/$/, "") || "/";
  const isLoginPost = method === "post" && path === "/token";
  if (typeof window !== "undefined" && !isLoginPost) {
    const t = sessionStorage.getItem(ACCESS_TOKEN_KEY);
    if (t) {
      config.headers.set("Authorization", `Bearer ${t}`);
    }
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      sessionStorage.removeItem(ACCESS_TOKEN_KEY);
      clearClientAccessTokenCookie();
      localStorage.removeItem("isLoggedIn");
      localStorage.removeItem("isAdminLoggedIn");
      localStorage.removeItem("role");
      window.location.href = "/blocked";
    }
    return Promise.reject(error);
  }
);

export const login = async (username: string, password: string) => {
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  }
  const params = new URLSearchParams();
  params.set("username", username.trim());
  params.set("password", password);
  params.set("grant_type", "password");
  const response = await api.post("/token", params.toString(), {
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
  });
  const data = response.data;
  if (typeof window !== "undefined" && data?.access_token) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
  }
  return data;
};

export const getSummary = async (params = {}) => {
  const response = await api.get("/analytics/summary", { params });
  return response.data;
};

export const getTrends = async (params = {}) => {
  const response = await api.get("/analytics/trends", { params });
  return response.data;
};

export const getDistribution = async (params = {}) => {
  const response = await api.get("/analytics/distribution", { params });
  return response.data;
};

export const getTopics = async (params = {}) => {
  const response = await api.get("/analytics/topics", { params });
  return response.data;
};

export const getThemeReport = async (params = {}) => {
  const response = await api.get("/analytics/theme-report", { params });
  return response.data;
};

export const getFullReport = async (params = {}) => {
  const response = await api.get("/analytics/consolidated-report", { params });
  return response.data;
};

export const sendReport = async (data: unknown) => {
  const response = await api.post("/analytics/send-report", data);
  return response.data;
};

export const getComments = async (params = {}) => {
  const response = await api.get("/comments", { params });
  return response.data;
};

export async function getCommentsPaged(
  params: Record<string, string | number | undefined> = {}
) {
  const clean = Object.fromEntries(
    Object.entries(params).filter(
      ([, v]) => v !== undefined && v !== ""
    )
  ) as Record<string, string | number>;
  const response = await api.get("/comments", { params: clean });
  const tc = response.headers["x-total-count"];
  const total =
    tc !== undefined ? parseInt(String(tc), 10) : (response.data as unknown[]).length;
  return { items: response.data as Record<string, unknown>[], total };
}

export const updateCommentTags = async (commentId: number, tags: string) => {
  const response = await api.patch(`/comments/${commentId}/tags`, { tags });
  return response.data;
};

export const getDatasets = async () => {
  const response = await api.get("/datasets");
  return response.data;
};

export const getUsers = async () => {
  const response = await api.get("/users");
  return response.data;
};

export const createUser = async (userData: unknown) => {
  const response = await api.post("/users", userData);
  return response.data;
};

export async function deleteUser(userId: number) {
  const { data } = await api.delete(`/users/${userId}`);
  return data;
}

export async function deleteDataset(id: number) {
  const { data } = await api.delete(`/datasets/${id}`);
  return data;
}

export const uploadCSV = async (formData: FormData) => {
  const response = await api.post("/upload", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const uploadChatbotCSV = async (
  file: File,
  accountName: string,
  socialNetwork: string = "Chatbot"
) => {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("account_name", accountName);
  formData.append("social_network", socialNetwork);
  const response = await api.post("/upload-chatbot", formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
  return response.data;
};

export const getConsolidatedReport = async (params = {}) => {
  const response = await api.get("/analytics/consolidated-report", { params });
  return response.data;
};

export const getMe = async () => {
  const response = await api.get("/api/auth/me");
  return response.data;
};

export const logout = async () => {
  await api.post("/api/auth/logout");
  if (typeof window !== "undefined") {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    clearClientAccessTokenCookie();
  }
  localStorage.removeItem("isLoggedIn");
  localStorage.removeItem("isAdminLoggedIn");
  localStorage.removeItem("role");
};
