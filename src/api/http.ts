import axios, { type AxiosResponse } from "axios";
import { apiBaseUrl } from "./config";
import { ApiError, toApiError } from "./errors";
import { getAccessToken } from "@/features/auth/session";

declare module "axios" {
  interface AxiosRequestConfig {
    /** The request handles 401 itself (sign-in): do not end the session. */
    skipSessionExpiry?: boolean;
  }
}

/** Every backend success body: { response, message }. */
export interface ApiEnvelope<T> {
  response: T;
  message: string;
}

export const unwrap = <T>(result: AxiosResponse<ApiEnvelope<T>>): T => result.data.response;

type UnauthorizedHandler = (error: ApiError) => void;
let onUnauthorized: UnauthorizedHandler | null = null;

/** The session layer registers how a 401 ends the session; returns an unregister function. */
export const setUnauthorizedHandler = (handler: UnauthorizedHandler | null) => {
  onUnauthorized = handler;
  return () => {
    if (onUnauthorized === handler) onUnauthorized = null;
  };
};

export const http = axios.create({
  baseURL: apiBaseUrl(),
  timeout: 15_000,
  headers: { Accept: "application/json" },
});

http.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.set("Authorization", `Bearer ${token}`);
  return config;
});

http.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    const apiError = toApiError(error);
    const skip = axios.isAxiosError(error) && error.config?.skipSessionExpiry;
    if (apiError.kind === "unauthorized" && !skip) onUnauthorized?.(apiError);
    return Promise.reject(apiError);
  }
);
