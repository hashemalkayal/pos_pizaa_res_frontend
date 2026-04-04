import Axios, { type AxiosInstance } from "axios";
import type { AxiosError, AxiosRequestConfig, AxiosResponse } from "axios";
import { axiosErrorHandling } from "./middlewares/error";

const axiosSetup = (baseURL: string = "", apiName: string): AxiosInstance => {
  const axiosConfig = {
    baseURL: `${baseURL}${apiName}`,
  };

  const axios: AxiosInstance = Axios.create(axiosConfig);

  const requestHandler = async (
    request: AxiosRequestConfig
  ): Promise<AxiosRequestConfig | any> => {
    const userToken: string | null = localStorage.getItem("token");

    request.headers = {
      ...request.headers,
      ...(userToken ? { Authorization: `Bearer ${userToken}` } : {}),
    };

    return request;
  };

  const onResponseError = async (error: AxiosError): Promise<AxiosError> => {
    axiosErrorHandling(
      Number(error.response?.status) || 500,
      error as AxiosError<any>
    );

    if (error.response?.status === 401 || error.response?.status === 403) {
    }

    return Promise.reject(error);
  };

  axios.interceptors.request.use(
    (request: AxiosRequestConfig) => requestHandler(request),
    (error: AxiosError) => Promise.reject(error)
  );

  axios.interceptors.response.use(
    (response: AxiosResponse) => response,
    (error: AxiosError) => onResponseError(error)
  );

  return axios;
};

export default axiosSetup;
