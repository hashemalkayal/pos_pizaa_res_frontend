//@ts-nocheck

import {
  QueryObserverResult,
  useInfiniteQuery,
  UseInfiniteQueryOptions,
  useMutation,
  UseMutationOptions,
  useQuery,
  UseQueryOptions,
} from "@tanstack/react-query";
import type { AxiosError } from "axios";

import { axiosRoute } from "../axiosRoutes";
import { IAxiosRoute } from "../types/types.types";

type ReturnTypeAsync<T extends (...args: any) => any> = T extends (
  ...args: any
) => Promise<infer R>
  ? R
  : unknown;

const sendRequest = async <
  T extends keyof IAxiosRoute,
  R extends keyof IAxiosRoute[T],
  TPayload extends IAxiosRoute[T][R] extends (data: infer P) => unknown
    ? P
    : never,
  TResult extends ReturnTypeAsync<IAxiosRoute[T][R]> = ReturnTypeAsync<
    IAxiosRoute[T][R]
  >
>(
  route: T,
  routeMethod: R,
  payload?: TPayload
): Promise<TResult> => {
  const query = axiosRoute[route][routeMethod] as IAxiosRoute[T][R] extends (
    data: infer P
  ) => unknown
    ? (data: P) => Promise<TResult>
    : never;

  const response = await query(payload);

  return response;
};

const useInfiniteQueryWithAxios = <
  T extends keyof IAxiosRoute,
  R extends keyof IAxiosRoute[T],
  TPayload extends IAxiosRoute[T][R] extends (data: infer P) => unknown
    ? P
    : never,
  TResult extends ReturnTypeAsync<IAxiosRoute[T][R]> = ReturnTypeAsync<
    IAxiosRoute[T][R]
  >
>(
  route: T,
  routeMethod: R,
  payload?: TPayload,
  options?: Omit<UseInfiniteQueryOptions<TResult, AxiosError>, "queryKey">
) => {
  return useInfiniteQuery<TResult, AxiosError>({
    ...options,
    queryKey: [`${route}-${String(routeMethod)}`, payload],
    queryFn: ({ pageParam = 1 }) =>
      sendRequest<T, R, TPayload, TResult>(route, routeMethod, {
        ...payload,
        page: pageParam,
      }),
  });
};

const useQueryWithAxios = <
  T extends keyof IAxiosRoute,
  R extends keyof IAxiosRoute[T],
  TPayload extends IAxiosRoute[T][R] extends (data: infer P) => unknown
    ? P
    : never,
  TResult extends ReturnTypeAsync<IAxiosRoute[T][R]> = ReturnTypeAsync<
    IAxiosRoute[T][R]
  >
>(
  route: T,
  routeMethod: R,
  payload?: TPayload,
  options?: Omit<UseQueryOptions<TResult, AxiosError>, "queryKey">
): QueryObserverResult<TResult, AxiosError> => {
  return useQuery<TResult, AxiosError>({
    ...options,
    queryKey: [`${route}`, String(routeMethod), { ...payload }],
    queryFn: () =>
      sendRequest<T, R, TPayload, TResult>(route, routeMethod, payload),
  });
};

const useMutationWithAxios = <
  T extends keyof IAxiosRoute,
  R extends keyof IAxiosRoute[T],
  TPayload extends IAxiosRoute[T][R] extends (data: infer P) => unknown
    ? P
    : never,
  TResult extends ReturnTypeAsync<IAxiosRoute[T][R]> = ReturnTypeAsync<
    IAxiosRoute[T][R]
  >
>(
  route: T,
  routeMethod: R,
  options?: Omit<
    UseMutationOptions<TResult, AxiosError, TPayload>,
    "mutationKey"
  >
) => {
  return useMutation<TResult, AxiosError, TPayload>({
    ...options,
    mutationKey: [route, routeMethod],
    mutationFn: (payload: TPayload) =>
      sendRequest<T, R, TPayload, TResult>(route, routeMethod, payload),
  });
};

export { useQueryWithAxios, useMutationWithAxios, useInfiniteQueryWithAxios };
