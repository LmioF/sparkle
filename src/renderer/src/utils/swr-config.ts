import { SWRConfiguration } from 'swr'

export const swrConfig: SWRConfiguration = {
  // 2秒内相同请求去重
  dedupingInterval: 2000,
  // 窗口聚焦不重新请求
  revalidateOnFocus: false,
  // 网络恢复不重新请求
  revalidateOnReconnect: false,
  // 错误重试次数
  errorRetryCount: 3,
  // 错误重试间隔
  errorRetryInterval: 1000,
  // 组件挂载时重新验证
  revalidateOnMount: true
}
