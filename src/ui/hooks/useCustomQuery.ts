import { useQuery, type UseQueryOptions } from '@tanstack/react-query'

/**
 * A thin wrapper around @tanstack/react-query's useQuery.
 * Defaults:
 *   - staleTime: 1 hour  (suitable for near-static remote JSON)
 *   - retry: 2
 *
 * Usage:
 *   const { data, isLoading, error } = useCustomQuery<TourData>(
 *     ['lessons'],
 *     () => fetch('https://git-mastery.org/lessons/lessons.json').then(r => r.json())
 *   )
 */
export function useCustomQuery<TData = unknown, TError = Error>(
  params: UseCustomQueryParams<TData, TError>
) {
  if ("queryUrl" in params) {
    const { queryKey, queryUrl, options } = params
    return useQuery<TData, TError>({
      queryKey,
      queryFn: () => fetch(queryUrl).then(r => r.json()),
      staleTime: 1000 * 60 * 60, // 1 hour
      retry: 2,
      ...options,
    })
  } else {
    const { queryKey, queryFn, options } = params
    return useQuery<TData, TError>({
      queryKey,
      queryFn,
      staleTime: 1000 * 60 * 60, // 1 hour
      retry: 2,
      ...options,
    })
  }
  // return useQuery<TData, TError>({
  //   queryKey,
  //   queryFn,
  //   staleTime: 1000 * 60 * 60, // 1 hour
  //   retry: 2,
  //   ...options,
  // })
}

type UseCustomQueryParams<TData = unknown, TError = Error> = {
  queryKey: UseQueryOptions<TData, TError>['queryKey'],
  queryUrl: string,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>

} | {
  queryKey: UseQueryOptions<TData, TError>['queryKey'],
  queryFn: () => Promise<TData>,
  options?: Omit<UseQueryOptions<TData, TError>, 'queryKey' | 'queryFn'>
}