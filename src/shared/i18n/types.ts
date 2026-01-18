declare const __brand: unique symbol

type Brand<T, TBrand extends string> = T & { readonly [__brand]: TBrand }

export type LanguageCode = Brand<string, 'LanguageCode'>

export type Namespace = Brand<string, 'Namespace'>

export type TranslationKey = Brand<string, 'TranslationKey'>

export function createLanguageCode(code: string): LanguageCode {
  return code as LanguageCode
}

export function createNamespace(ns: string): Namespace {
  return ns as Namespace
}

export function createTranslationKey(key: string): TranslationKey {
  return key as TranslationKey
}

export interface TranslationResource {
  readonly [key: string]: string | TranslationResource
}

export interface LanguageResource {
  readonly [namespace: string]: TranslationResource
}

export interface LanguageMeta {
  readonly languageId: LanguageCode
  readonly languageName?: string
  readonly author?: string
  readonly version?: string
  readonly description?: string
  readonly lastUpdated?: string
}

export interface TranslationFile {
  readonly _meta: LanguageMeta
  readonly [namespace: string]: LanguageMeta | TranslationResource
}

export type TranslationSource = 'builtin' | 'external' | 'custom'

export interface LanguageInfo {
  readonly id: LanguageCode
  readonly name: string
  readonly source: TranslationSource
  readonly filePath?: string
}

export interface Ok<T> {
  readonly success: true
  readonly data: T
}

export interface Err<E extends Error> {
  readonly success: false
  readonly error: E
}

export type Result<T, E extends Error = Error> = Ok<T> | Err<E>

export function ok<T>(data: T): Ok<T> {
  return { success: true, data }
}

export function err<E extends Error>(error: E): Err<E> {
  return { success: false, error }
}

export function isOk<T, E extends Error>(result: Result<T, E>): result is Ok<T> {
  return result.success
}

export function isErr<T, E extends Error>(result: Result<T, E>): result is Err<E> {
  return !result.success
}

export abstract class I18nError extends Error {
  abstract readonly code: string

  abstract readonly retryable: boolean

  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message)
    this.name = this.constructor.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class LoadError extends I18nError {
  readonly code = 'LOAD_ERROR'
  readonly retryable = true

  constructor(
    message: string,
    public readonly language: LanguageCode,
    public readonly namespace: Namespace,
    cause?: Error
  ) {
    super(message, cause)
  }
}

export class ParseError extends I18nError {
  readonly code = 'PARSE_ERROR'
  readonly retryable = false

  constructor(
    message: string,
    public readonly filePath: string,
    cause?: Error
  ) {
    super(message, cause)
  }
}

export class ValidationError extends I18nError {
  readonly code = 'VALIDATION_ERROR'
  readonly retryable = false

  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message)
  }
}

export class NetworkError extends I18nError {
  readonly code = 'NETWORK_ERROR'
  readonly retryable = true

  constructor(message: string, cause?: Error) {
    super(message, cause)
  }
}

export class InitializationError extends I18nError {
  readonly code = 'INITIALIZATION_ERROR'
  readonly retryable = false

  constructor(message: string, cause?: Error) {
    super(message, cause)
  }
}

export type LoadResult = Result<
  {
    readonly builtin: TranslationResource
    readonly external: TranslationResource
    readonly custom: TranslationResource
    readonly merged: TranslationResource
  },
  LoadError
>

export interface ITranslationLoader {
  load(language: LanguageCode, namespace: Namespace): Promise<LoadResult>

  clearCache(): void

  clearLanguageCache(language: LanguageCode): void
}

export interface ICache<K, V> {
  get(key: K): V | undefined

  set(key: K, value: V): void

  delete(key: K): boolean

  clear(): void

  readonly size: number

  has(key: K): boolean

  keys(): K[]
}

export interface I18nConfig {
  readonly builtinLanguages: readonly LanguageCode[]
  readonly defaultLanguage: LanguageCode
  readonly fallbackLanguage: readonly LanguageCode[]
  readonly namespaces: readonly Namespace[]
  readonly defaultNamespace: Namespace
  readonly paths: {
    readonly builtin: string
    readonly external: string
    readonly custom: string
  }
  readonly cache?: {
    readonly maxSize?: number
    readonly ttl?: number
  }
  readonly performance?: {
    readonly enableMetrics?: boolean
    readonly enablePreload?: boolean
  }
}

export interface PerformanceMetrics {
  readonly loadTime: number
  readonly cacheHitRate: number
  readonly totalLoads: number
  readonly cacheHits: number
  readonly cacheMisses: number
}

export type I18nEventType =
  | 'initialized'
  | 'languageChanged'
  | 'namespaceLoaded'
  | 'loadError'
  | 'cacheCleared'

export interface I18nEventData {
  initialized: { language: LanguageCode }
  languageChanged: { from: LanguageCode; to: LanguageCode }
  namespaceLoaded: { language: LanguageCode; namespace: Namespace }
  loadError: { error: I18nError }
  cacheCleared: { language?: LanguageCode }
}

export type EventListener<T extends I18nEventType> = (data: I18nEventData[T]) => void

export interface IEventEmitter {
  on<T extends I18nEventType>(event: T, listener: EventListener<T>): void

  off<T extends I18nEventType>(event: T, listener: EventListener<T>): void

  emit<T extends I18nEventType>(event: T, data: I18nEventData[T]): void
}
