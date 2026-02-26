import axios from "axios";
import type { AxiosError, InternalAxiosRequestConfig } from "axios";
import type { DataProvider } from "@refinedev/core";
import { refreshAccessToken } from "./auth-provider";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:7001";
const TOKEN_KEY = "martly_admin_token";

const axiosInstance = axios.create({ baseURL: `${API_URL}/api/v1` });

axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor: auto-refresh on 401
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && originalRequest && !originalRequest._retry) {
      originalRequest._retry = true;

      const newToken = await refreshAccessToken();
      if (newToken) {
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return axiosInstance(originalRequest);
      }
    }

    return Promise.reject(error);
  },
);

export { axiosInstance };

export const martlyDataProvider: DataProvider = {
  getList: async ({ resource, pagination, sorters, filters }) => {
    const { current = 1, pageSize = 20 } = pagination ?? {};
    const params: Record<string, string | number> = { page: current, pageSize };

    if (sorters && sorters.length > 0) {
      params.sortBy = sorters[0].field;
      params.sortOrder = sorters[0].order;
    }

    if (filters) {
      for (const filter of filters) {
        if ("field" in filter && filter.value !== undefined && filter.value !== "") {
          params[filter.field] = filter.value;
        }
      }
    }

    const { data: res } = await axiosInstance.get(`/${resource}`, { params });
    return { data: res.data, total: res.meta?.total ?? res.data.length };
  },

  getOne: async ({ resource, id }) => {
    const { data: res } = await axiosInstance.get(`/${resource}/${id}`);
    return { data: res.data };
  },

  create: async ({ resource, variables }) => {
    const { data: res } = await axiosInstance.post(`/${resource}`, variables);
    return { data: res.data };
  },

  update: async ({ resource, id, variables }) => {
    const { data: res } = await axiosInstance.put(`/${resource}/${id}`, variables);
    return { data: res.data };
  },

  deleteOne: async ({ resource, id }) => {
    const { data: res } = await axiosInstance.delete(`/${resource}/${id}`);
    return { data: res.data };
  },

  getApiUrl: () => `${API_URL}/api/v1`,

  custom: async ({ url, method, payload }) => {
    // Strip the baseURL prefix if present so axiosInstance doesn't double it
    const base = `${API_URL}/api/v1`;
    const resolvedUrl = url.startsWith(base) ? url.slice(base.length) : url;
    const { data: res } = await axiosInstance.request({
      url: resolvedUrl,
      method: method as string,
      data: payload,
    });
    return { data: res };
  },
};
