import { Button, Card, CardBody, Chip } from '@heroui/react'
import { Avatar } from '@heroui-v3/react'
import BasePage from '@renderer/components/base/base-page'
import { useAppConfig } from '@renderer/hooks/use-app-config'
import {
  getImageDataURL,
  mihomoChangeProxy,
  mihomoCloseConnections,
  mihomoGroupDelay,
  mihomoProxyDelay
} from '@renderer/utils/ipc'
import { FaLocationCrosshairs } from 'react-icons/fa6'
import { useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
import { GroupedVirtuoso, GroupedVirtuosoHandle } from 'react-virtuoso'
import ProxyItem from '@renderer/components/proxies/proxy-item'
import ProxySettingModal from '@renderer/components/proxies/proxy-setting-modal'
import { IoIosArrowBack } from 'react-icons/io'
import { MdDoubleArrow, MdOutlineSpeed, MdTune } from 'react-icons/md'
import { useGroups } from '@renderer/hooks/use-groups'
import { useProxiesState } from '@renderer/hooks/use-proxies-state'
import CollapseInput from '@renderer/components/base/collapse-input'
import { includesIgnoreCase } from '@renderer/utils/includes'
import { useControledMihomoConfig } from '@renderer/hooks/use-controled-mihomo-config'
import { useTranslation } from '@renderer/hooks/useTranslation'
import { runDelayTestsWithConcurrency } from '@renderer/utils/delay-test'

type ProxyLike = ControllerProxiesDetail | ControllerGroupDetail

const EMPTY_PROXIES: ProxyLike[] = []

function getProxyDelay(proxy: ProxyLike): number {
  return proxy.history.length > 0 ? proxy.history[proxy.history.length - 1].delay : -1
}

function compareProxyDelay(a: ProxyLike, b: ProxyLike): number {
  const delayA = getProxyDelay(a)
  const delayB = getProxyDelay(b)
  if (delayA === -1) return -1
  if (delayB === -1) return 1
  if (delayA === 0) return 1
  if (delayB === 0) return -1
  return delayA - delayB
}

const Proxies: React.FC = () => {
  const { t } = useTranslation('proxy')
  const { controledMihomoConfig } = useControledMihomoConfig()
  const { mode = 'rule' } = controledMihomoConfig || {}
  const { groups = [], mutate } = useGroups()
  const { isOpenMap, searchValueMap, setIsOpen, setSearchValue, syncGroups } = useProxiesState()
  const { appConfig } = useAppConfig()
  const {
    proxyDisplayLayout = 'double',
    groupDisplayLayout = 'double',
    proxyDisplayOrder = 'default',
    autoCloseConnection = true,
    closeMode = 'all',
    proxyCols = 'auto',
    delayTestUrlScope = 'group',
    delayTestUseGroupApi = false,
    delayTestConcurrency
  } = appConfig || {}
  const [cols, setCols] = useState(1)
  const [delaying, setDelaying] = useState<Map<string, boolean>>(new Map())
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null)
  const pendingScrollRef = useRef<number | null>(null)

  useEffect(() => {
    syncGroups(groups.map((g) => g.name))
  }, [groups, syncGroups])

  const { groupCounts, allProxies } = useMemo(() => {
    const groupCounts: number[] = []
    const allProxies: ProxyLike[][] = []
    groups.forEach((group) => {
      const isGroupOpen = isOpenMap.get(group.name) ?? false
      const groupSearchValue = searchValueMap.get(group.name) ?? ''
      if (isGroupOpen) {
        let groupProxies = groupSearchValue
          ? group.all.filter((proxy) => proxy && includesIgnoreCase(proxy.name, groupSearchValue))
          : (group.all as ProxyLike[])

        if (proxyDisplayOrder === 'delay') {
          groupProxies = [...groupProxies].sort(compareProxyDelay)
        }
        if (proxyDisplayOrder === 'name') {
          groupProxies = [...groupProxies].sort((a, b) => a.name.localeCompare(b.name))
        }

        groupCounts.push(Math.ceil(groupProxies.length / cols))
        allProxies.push(groupProxies)
      } else {
        groupCounts.push(0)
        allProxies.push(EMPTY_PROXIES)
      }
    })
    return { groupCounts, allProxies }
  }, [groups, isOpenMap, searchValueMap, proxyDisplayOrder, cols])

  const onChangeProxy = useCallback(
    async (group: string, proxy: string): Promise<void> => {
      await mihomoChangeProxy(group, proxy)
      if (autoCloseConnection) {
        if (closeMode === 'all') {
          await mihomoCloseConnections()
        } else if (closeMode === 'group') {
          await mihomoCloseConnections(group)
        }
      }
      mutate()
    },
    [autoCloseConnection, closeMode, mutate]
  )

  const getDelayTestUrl = useCallback(
    (group?: ControllerMixedGroup): string | undefined => {
      if (delayTestUrlScope === 'global') return undefined
      return group?.testUrl
    },
    [delayTestUrlScope]
  )

  const onProxyDelay = useCallback(
    async (proxy: string, group?: ControllerMixedGroup): Promise<ControllerProxiesDelay> => {
      return await mihomoProxyDelay(proxy, getDelayTestUrl(group))
    },
    [getDelayTestUrl]
  )

  const setGroupDelaying = useCallback((groupName: string, value: boolean): void => {
    setDelaying((prev) => {
      const next = new Map(prev)
      next.set(groupName, value)
      return next
    })
  }, [])

  const onGroupDelay = useCallback(
    async (index: number): Promise<void> => {
      const group = groups[index]
      if (!group) return

      const openedProxies = allProxies[index] || EMPTY_PROXIES
      const proxies = openedProxies.length > 0 ? openedProxies : group.all
      if (proxies.length === 0) return

      if (openedProxies.length === 0) {
        setIsOpen(group.name, true)
      }

      const testUrl = getDelayTestUrl(group)
      setGroupDelaying(group.name, true)

      try {
        if (delayTestUseGroupApi) {
          await mihomoGroupDelay(group.name, testUrl)
          return
        }

        await runDelayTestsWithConcurrency(proxies, delayTestConcurrency, async (proxy) => {
          try {
            await mihomoProxyDelay(proxy.name, testUrl)
          } catch {
            // ignore
          }
        })
      } catch {
        // ignore
      } finally {
        mutate()
        setGroupDelaying(group.name, false)
      }
    },
    [
      allProxies,
      groups,
      delayTestUseGroupApi,
      delayTestConcurrency,
      mutate,
      setIsOpen,
      getDelayTestUrl,
      setGroupDelaying
    ]
  )

  const calcCols = useCallback((): number => {
    if (window.matchMedia('(min-width: 1536px)').matches) {
      return 5
    } else if (window.matchMedia('(min-width: 1280px)').matches) {
      return 4
    } else if (window.matchMedia('(min-width: 1024px)').matches) {
      return 3
    } else {
      return 2
    }
  }, [])

  const toggleOpen = useCallback(
    (index: number) => {
      const group = groups[index]
      setIsOpen(group.name, !(isOpenMap.get(group.name) ?? false))
    },
    [groups, isOpenMap, setIsOpen]
  )

  const updateSearchValue = useCallback(
    (index: number, value: string) => {
      const group = groups[index]
      if (!group) return
      setSearchValue(group.name, value)
      if (value) {
        setIsOpen(group.name, true)
      }
    },
    [groups, setSearchValue, setIsOpen]
  )

  const doScrollToCurrentProxy = useCallback(
    (index: number) => {
      const group = groups[index]
      if (!group) return
      let i = 0
      for (let j = 0; j < index; j++) {
        i += groupCounts[j]
      }
      const proxies = allProxies[index].length > 0 ? allProxies[index] : group.all
      i += Math.floor(proxies.findIndex((proxy) => proxy.name === group.now) / cols)
      virtuosoRef.current?.scrollToIndex({
        index: Math.floor(i),
        align: 'start',
        behavior: 'smooth'
      })
    },
    [groupCounts, allProxies, groups, cols]
  )

  useEffect(() => {
    if (pendingScrollRef.current !== null) {
      const index = pendingScrollRef.current
      const group = groups[index]
      if (group && (isOpenMap.get(group.name) ?? false)) {
        pendingScrollRef.current = null
        setTimeout(() => doScrollToCurrentProxy(index), 150)
      }
    }
  }, [groups, isOpenMap, doScrollToCurrentProxy])

  const scrollToCurrentProxy = useCallback(
    (index: number) => {
      const group = groups[index]
      if (!group) return
      if (!(isOpenMap.get(group.name) ?? false)) {
        pendingScrollRef.current = index
        setIsOpen(group.name, true)
      } else {
        doScrollToCurrentProxy(index)
      }
    },
    [groups, isOpenMap, setIsOpen, doScrollToCurrentProxy]
  )

  useEffect(() => {
    if (proxyCols !== 'auto') {
      setCols(parseInt(proxyCols))
      return
    }
    setCols(calcCols())
    const handleResize = (): void => {
      setCols(calcCols())
    }
    window.addEventListener('resize', handleResize)
    return (): void => {
      window.removeEventListener('resize', handleResize)
    }
  }, [proxyCols, calcCols])

  const groupContent = useCallback(
    (index: number) => {
      if (
        groups[index] &&
        groups[index].icon &&
        groups[index].icon.startsWith('http') &&
        !localStorage.getItem(groups[index].icon)
      ) {
        getImageDataURL(groups[index].icon)
          .then((dataURL) => {
            localStorage.setItem(groups[index].icon, dataURL)
            mutate()
          })
          .catch((e) => {
            console.warn('Failed to load group icon:', groups[index].icon, e)
          })
      }
      const group = groups[index]
      const isGroupOpen = isOpenMap.get(group.name) ?? false
      const groupSearchValue = searchValueMap.get(group.name) ?? ''
      const isGroupDelaying = delaying.get(group.name) ?? false
      return group ? (
        <div
          className={`w-full pt-2 ${index === groupCounts.length - 1 && !isGroupOpen ? 'pb-2' : ''} px-2`}
        >
          <Card as="div" isPressable fullWidth onPress={() => toggleOpen(index)}>
            <CardBody className="w-full h-14">
              <div className="flex justify-between h-full">
                <div className="flex text-ellipsis overflow-hidden whitespace-nowrap h-full">
                  {group.icon ? (
                    <Avatar
                      className="mr-2 h-8 w-8 shrink-0 bg-transparent overflow-visible! rounded-none!"
                      size="sm"
                    >
                      <Avatar.Image
                        className="object-contain"
                        src={
                          group.icon.startsWith('<svg')
                            ? `data:image/svg+xml;utf8,${group.icon}`
                            : localStorage.getItem(group.icon) || group.icon
                        }
                      />
                    </Avatar>
                  ) : null}
                  <div
                    className={`flex flex-col h-full ${groupDisplayLayout === 'double' ? '' : 'justify-center'}`}
                  >
                    <div
                      className={`text-ellipsis overflow-hidden whitespace-nowrap leading-tight ${groupDisplayLayout === 'double' ? 'text-md flex-5 flex items-center' : 'text-lg'}`}
                    >
                      <span className="flag-emoji inline-block">{group.name}</span>
                      {groupDisplayLayout === 'single' && (
                        <>
                          <div
                            title={group.type}
                            className="inline ml-2 text-sm text-foreground-500"
                          >
                            {group.type}
                          </div>
                          <div className="inline flag-emoji ml-2 text-sm text-foreground-500">
                            {group.now}
                          </div>
                        </>
                      )}
                    </div>
                    {groupDisplayLayout === 'double' && (
                      <div className="text-ellipsis whitespace-nowrap text-[10px] text-foreground-500 leading-tight flex-3 flex items-center">
                        <span>{group.type}</span>
                        <span className="flag-emoji ml-1 inline-block">{group.now}</span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center">
                  <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
                    <Chip size="sm" className="my-1 mr-2">
                      {group.all.length}
                    </Chip>
                    <CollapseInput
                      title={t('searchNode')}
                      value={groupSearchValue}
                      onValueChange={(v) => updateSearchValue(index, v)}
                    />
                    <Button
                      title={t('locateCurrentNode')}
                      aria-label={t('locateCurrentNode')}
                      variant="light"
                      size="sm"
                      isIconOnly
                      onPress={() => scrollToCurrentProxy(index)}
                    >
                      <FaLocationCrosshairs className="text-lg text-foreground-500" />
                    </Button>
                    <Button
                      title={t('delayTest')}
                      aria-label={t('delayTest')}
                      variant="light"
                      isLoading={isGroupDelaying}
                      size="sm"
                      isIconOnly
                      onPress={() => onGroupDelay(index)}
                    >
                      <MdOutlineSpeed className="text-lg text-foreground-500" />
                    </Button>
                  </div>
                  <IoIosArrowBack
                    className={`transition duration-200 ml-2 h-8 text-lg text-foreground-500 flex items-center ${isGroupOpen ? '-rotate-90' : ''}`}
                  />
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      ) : (
        <div>{t('neverSeeThis')}</div>
      )
    },
    [
      groups,
      groupCounts,
      isOpenMap,
      searchValueMap,
      delaying,
      groupDisplayLayout,
      toggleOpen,
      updateSearchValue,
      scrollToCurrentProxy,
      onGroupDelay,
      mutate
    ]
  )

  const itemContent = useCallback(
    (index: number, groupIndex: number) => {
      let innerIndex = index
      for (let i = 0; i < groupIndex; i++) {
        innerIndex -= groupCounts[i]
      }

      const proxies = allProxies[groupIndex]
      const items: ReactNode[] = []
      for (let i = 0; i < cols; i++) {
        const proxy = proxies[innerIndex * cols + i]
        if (!proxy) continue

        items.push(
          <ProxyItem
            key={proxy.name}
            mutateProxies={mutate}
            onProxyDelay={onProxyDelay}
            onSelect={onChangeProxy}
            proxy={proxy}
            group={groups[groupIndex]}
            proxyDisplayLayout={proxyDisplayLayout}
            selected={proxy.name === groups[groupIndex].now}
          />
        )
      }

      return proxies ? (
        <div
          style={
            proxyCols !== 'auto'
              ? { gridTemplateColumns: `repeat(${proxyCols}, minmax(0, 1fr))` }
              : {}
          }
          className={`grid ${proxyCols === 'auto' ? 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5' : ''} ${groupIndex === groupCounts.length - 1 && innerIndex === groupCounts[groupIndex] - 1 ? 'pb-2' : ''} gap-2 pt-2 mx-2`}
        >
          {items}
        </div>
      ) : (
        <div>{t('neverSeeThis')}</div>
      )
    },
    [
      groupCounts,
      allProxies,
      proxyCols,
      cols,
      mutate,
      onProxyDelay,
      onChangeProxy,
      groups,
      proxyDisplayLayout,
      t
    ]
  )

  return (
    <BasePage
      title={t('title')}
      header={
        <Button
          size="sm"
          isIconOnly
          variant="light"
          className="app-nodrag"
          title={t('settings')}
          aria-label={t('settings')}
          onPress={() => setIsSettingModalOpen(true)}
        >
          <MdTune className="text-lg" />
        </Button>
      }
    >
      {isSettingModalOpen && <ProxySettingModal onClose={() => setIsSettingModalOpen(false)} />}
      {mode === 'direct' ? (
        <div className="h-full w-full flex justify-center items-center">
          <div className="flex flex-col items-center">
            <MdDoubleArrow className="text-foreground-500 text-[100px]" />
            <h2 className="text-foreground-500 text-[20px]">{t('directMode')}</h2>
          </div>
        </div>
      ) : (
        <div className="h-[calc(100vh-50px)]">
          <GroupedVirtuoso
            ref={virtuosoRef}
            groupCounts={groupCounts}
            groupContent={groupContent}
            itemContent={itemContent}
          />
        </div>
      )}
    </BasePage>
  )
}

export default Proxies
