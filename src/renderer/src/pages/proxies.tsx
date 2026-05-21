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
import { memo, useEffect, useMemo, useRef, useState, useCallback, type ReactNode } from 'react'
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

interface GroupHeaderProps {
  index: number
  group: ControllerMixedGroup
  isOpen: boolean
  isLast: boolean
  groupDisplayLayout: 'hidden' | 'single' | 'double'
  searchValue: string
  delaying: boolean
  labels: {
    searchNode: string
    locateCurrentNode: string
    delayTest: string
  }
  onToggle: (index: number, currentlyOpen: boolean) => void
  onUpdateSearch: (index: number, value: string) => void
  onScrollToProxy: (index: number) => void
  onGroupDelay: (index: number) => void
}

const GroupHeader = memo(function GroupHeader({
  index,
  group,
  isOpen,
  isLast,
  groupDisplayLayout,
  searchValue,
  delaying,
  labels,
  onToggle,
  onUpdateSearch,
  onScrollToProxy,
  onGroupDelay
}: GroupHeaderProps) {
  return (
    <div className={`w-full pt-2 ${isLast && !isOpen ? 'pb-2' : ''} px-2`}>
      <Card as="div" isPressable fullWidth onPress={() => onToggle(index, isOpen)}>
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
                className={`flex flex-col h-full ${
                  groupDisplayLayout === 'double' ? '' : 'justify-center'
                }`}
              >
                <div
                  className={`text-ellipsis overflow-hidden whitespace-nowrap leading-tight ${
                    groupDisplayLayout === 'double' ? 'text-md flex-5 flex items-center' : 'text-lg'
                  }`}
                >
                  <span className="flag-emoji inline-block">{group.name}</span>
                  {groupDisplayLayout === 'single' && (
                    <>
                      <div className="inline ml-2 text-sm text-foreground-500">{group.type}</div>
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
              <div
                className="flex items-center"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              >
                <Chip size="sm" className="my-1 mr-2">
                  {group.all.length}
                </Chip>
                <CollapseInput
                  aria-label={labels.searchNode}
                  value={searchValue}
                  onValueChange={(v) => onUpdateSearch(index, v)}
                />
                <Button
                  aria-label={labels.locateCurrentNode}
                  variant="light"
                  size="sm"
                  isIconOnly
                  onPress={() => onScrollToProxy(index)}
                >
                  <FaLocationCrosshairs className="text-lg text-foreground-500" />
                </Button>
                <Button
                  aria-label={labels.delayTest}
                  variant="light"
                  isLoading={delaying}
                  size="sm"
                  isIconOnly
                  onPress={() => onGroupDelay(index)}
                >
                  <MdOutlineSpeed className="text-lg text-foreground-500" />
                </Button>
              </div>
              <IoIosArrowBack
                className={`transition duration-200 ml-2 h-8 text-lg text-foreground-500 flex items-center ${
                  isOpen ? '-rotate-90' : ''
                }`}
              />
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  )
})

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
    showGroupSelectedProxy = true,
    proxyDisplayOrder = 'default',
    autoCloseConnection = true,
    closeMode = 'all',
    proxyCols = 'auto',
    delayTestUrlScope = 'group',
    delayTestUseGroupApi = false,
    delayTestConcurrency
  } = appConfig || {}
  const [cols, setCols] = useState(1)
  const [openContentMap, setOpenContentMap] = useState<Map<string, boolean>>(new Map())
  const [delaying, setDelaying] = useState<Map<string, boolean>>(new Map())
  const [isSettingModalOpen, setIsSettingModalOpen] = useState(false)
  const virtuosoRef = useRef<GroupedVirtuosoHandle>(null)
  const pendingScrollRef = useRef<number | null>(null)

  const openContentRef = useRef(openContentMap)
  openContentRef.current = openContentMap

  useEffect(() => {
    const names = groups.map((g) => g.name)
    syncGroups(names)
    setOpenContentMap((prev) => {
      const next = new Map<string, boolean>()
      names.forEach((name) => {
        next.set(name, prev.get(name) ?? isOpenMap.get(name) ?? false)
      })
      return next
    })
  }, [groups, syncGroups, isOpenMap])

  const { groupCounts, allProxies } = useMemo(() => {
    const groupCounts: number[] = []
    const allProxies: ProxyLike[][] = []
    groups.forEach((group) => {
      const shouldRenderContent = openContentMap.get(group.name) ?? false
      const groupSearchValue = searchValueMap.get(group.name) ?? ''
      if (shouldRenderContent) {
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
  }, [groups, openContentMap, searchValueMap, proxyDisplayOrder, cols])

  const setGroupContentOpen = useCallback((groupName: string, value: boolean): void => {
    setOpenContentMap((prev) => {
      const next = new Map(prev)
      next.set(groupName, value)
      return next
    })
  }, [])

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
        setTimeout(() => setGroupContentOpen(group.name, true), 0)
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
      setGroupDelaying,
      setGroupContentOpen
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
    (index: number, currentlyOpen: boolean) => {
      const group = groups[index]
      if (!group) return

      setIsOpen(group.name, !currentlyOpen)
      if (currentlyOpen) {
        setGroupContentOpen(group.name, false)
      } else {
        setTimeout(() => setGroupContentOpen(group.name, true), 0)
      }
    },
    [groups, setIsOpen, setGroupContentOpen]
  )

  const updateSearchValue = useCallback(
    (index: number, value: string) => {
      const group = groups[index]
      if (!group) return
      setSearchValue(group.name, value)
      if (value) {
        setIsOpen(group.name, true)
        setTimeout(() => setGroupContentOpen(group.name, true), 0)
      }
    },
    [groups, setSearchValue, setIsOpen, setGroupContentOpen]
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
      if (group && (openContentMap.get(group.name) ?? false)) {
        pendingScrollRef.current = null
        setTimeout(() => doScrollToCurrentProxy(index), 150)
      }
    }
  }, [groups, openContentMap, doScrollToCurrentProxy])

  const scrollToCurrentProxy = useCallback(
    (index: number) => {
      const group = groups[index]
      if (!group) return
      if (!(openContentRef.current.get(group.name) ?? false)) {
        pendingScrollRef.current = index
        setIsOpen(group.name, true)
        setTimeout(() => setGroupContentOpen(group.name, true), 0)
      } else {
        doScrollToCurrentProxy(index)
      }
    },
    [groups, setIsOpen, setGroupContentOpen, doScrollToCurrentProxy]
  )

  const onGroupDelayRef = useRef(onGroupDelay)
  onGroupDelayRef.current = onGroupDelay
  const onGroupDelayStable = useCallback((i: number) => {
    onGroupDelayRef.current(i)
  }, [])

  const scrollToCurrentProxyRef = useRef(scrollToCurrentProxy)
  scrollToCurrentProxyRef.current = scrollToCurrentProxy
  const scrollToCurrentProxyStable = useCallback((i: number) => {
    scrollToCurrentProxyRef.current(i)
  }, [])

  const groupsRef = useRef(groups)
  groupsRef.current = groups
  const isOpenMapRef = useRef(isOpenMap)
  isOpenMapRef.current = isOpenMap
  const groupDisplayLayoutRef = useRef(groupDisplayLayout)
  groupDisplayLayoutRef.current = groupDisplayLayout
  const searchValueMapRef = useRef(searchValueMap)
  searchValueMapRef.current = searchValueMap
  const delayingRef = useRef(delaying)
  delayingRef.current = delaying
  const groupCountsRef = useRef(groupCounts)
  groupCountsRef.current = groupCounts
  const allProxiesRef = useRef(allProxies)
  allProxiesRef.current = allProxies
  const colsRef = useRef(cols)
  colsRef.current = cols
  const mutateRef = useRef(mutate)
  mutateRef.current = mutate
  const onProxyDelayRef = useRef(onProxyDelay)
  onProxyDelayRef.current = onProxyDelay
  const onChangeProxyRef = useRef(onChangeProxy)
  onChangeProxyRef.current = onChangeProxy
  const proxyDisplayLayoutRef = useRef(proxyDisplayLayout)
  proxyDisplayLayoutRef.current = proxyDisplayLayout
  const showGroupSelectedProxyRef = useRef(showGroupSelectedProxy)
  showGroupSelectedProxyRef.current = showGroupSelectedProxy
  const proxyColsRef = useRef(proxyCols)
  proxyColsRef.current = proxyCols
  const toggleOpenRef = useRef(toggleOpen)
  toggleOpenRef.current = toggleOpen
  const updateSearchValueRef = useRef(updateSearchValue)
  updateSearchValueRef.current = updateSearchValue
  const groupHeaderLabels = useMemo(
    () => ({
      searchNode: t('searchNode'),
      locateCurrentNode: t('locateCurrentNode'),
      delayTest: t('delayTest')
    }),
    [t]
  )
  const groupHeaderLabelsRef = useRef(groupHeaderLabels)
  groupHeaderLabelsRef.current = groupHeaderLabels

  useEffect(() => {
    groups.forEach((group) => {
      if (group.icon && group.icon.startsWith('http') && !localStorage.getItem(group.icon)) {
        getImageDataURL(group.icon)
          .then((dataURL) => {
            localStorage.setItem(group.icon, dataURL)
            mutate()
          })
          .catch((error) => {
            console.warn('Failed to load group icon:', group.icon, error)
          })
      }
    })
  }, [groups, mutate])

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
      const group = groupsRef.current[index]
      return group ? (
        <GroupHeader
          index={index}
          group={group}
          isOpen={isOpenMapRef.current.get(group.name) ?? false}
          isLast={index === groupsRef.current.length - 1}
          groupDisplayLayout={groupDisplayLayoutRef.current}
          searchValue={searchValueMapRef.current.get(group.name) ?? ''}
          delaying={delayingRef.current.get(group.name) ?? false}
          labels={groupHeaderLabelsRef.current}
          onToggle={toggleOpenRef.current}
          onUpdateSearch={updateSearchValueRef.current}
          onScrollToProxy={scrollToCurrentProxyStable}
          onGroupDelay={onGroupDelayStable}
        />
      ) : (
        <div>{t('neverSeeThis')}</div>
      )
    },
    [isOpenMap, searchValueMap, delaying, t, scrollToCurrentProxyStable, onGroupDelayStable]
  )

  const itemContent = useCallback(
    (index: number, groupIndex: number) => {
      const groupCounts = groupCountsRef.current
      const allProxies = allProxiesRef.current
      const groups = groupsRef.current
      const cols = colsRef.current
      const currentProxyCols = proxyColsRef.current
      const currentProxyDisplayLayout = proxyDisplayLayoutRef.current
      const currentShowGroupSelectedProxy = showGroupSelectedProxyRef.current
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
            mutateProxies={mutateRef.current}
            onProxyDelay={onProxyDelayRef.current}
            onSelect={onChangeProxyRef.current}
            proxy={proxy}
            group={groups[groupIndex]}
            proxyDisplayLayout={currentProxyDisplayLayout}
            showGroupSelectedProxy={currentShowGroupSelectedProxy}
            selected={proxy.name === groups[groupIndex].now}
          />
        )
      }

      return proxies ? (
        <div
          style={{
            animation: 'proxy-row-in 0.15s ease both',
            ...(currentProxyCols !== 'auto'
              ? { gridTemplateColumns: `repeat(${currentProxyCols}, minmax(0, 1fr))` }
              : {})
          }}
          className={`grid ${
            currentProxyCols === 'auto'
              ? 'sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5'
              : ''
          } ${
            groupIndex === groupCounts.length - 1 && innerIndex === groupCounts[groupIndex] - 1
              ? 'pb-2'
              : ''
          } gap-2 pt-2 mx-2`}
        >
          {items}
        </div>
      ) : (
        <div>{t('neverSeeThis')}</div>
      )
    },
    [t]
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
            defaultItemHeight={72}
            overscan={200}
          />
        </div>
      )}
    </BasePage>
  )
}

export default Proxies
