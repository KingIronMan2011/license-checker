export type CustomFormatValue = string | boolean | undefined;
export type CustomFormat = Record<string, CustomFormatValue>;

export interface LicenseCheckOptions {
  start: string;
  production?: boolean;
  development?: boolean;
  unknown?: boolean;
  onlyunknown?: boolean;
  json?: boolean;
  csv?: boolean;
  csvComponentPrefix?: string;
  out?: string;
  customPath?: string;
  excludeLicenses?: string;
  relativeLicensePath?: boolean;
  relativeModulePath?: boolean;
  summary?: boolean;
  failOn?: string;
  onlyAllow?: string;
  includePackages?: string;
  excludePackages?: string;
  excludePrivatePackages?: boolean;
  excludePackagesStartingWith?: string;
  direct?: boolean | number;
  depth?: number;
  color?: boolean;
  customFormat?: CustomFormat;
  nopeer?: boolean;
  clarificationsFile?: string;
  clarificationsMatchAll?: boolean;
  includeLicenses?: string;
  files?: string;
  markdown?: boolean;
  plainVertical?: boolean;
  silent?: boolean;
  limitAttributes?: string;
  angularCli?: boolean;
}

export interface ModuleInfo {
  name?: string;
  version?: string;
  description?: string;
  repository?: string;
  publisher?: string;
  email?: string;
  url?: string;
  licenses?: LicenseValue | LicenseValue[];
  licenseFile?: string;
  licenseText?: string;
  licenseModified?: string;
  private?: boolean;
  path?: string;
  relativeModulePath?: boolean;
  copyright?: string;
  noticeFile?: string;
  [key: string]: unknown;
}

export type ModuleInfos = Record<string, ModuleInfo>;

export interface DependencyPackage {
  name?: string;
  version?: string;
  description?: string;
  repository?: string | { url?: string };
  author?: string | { name?: string; email?: string; url?: string };
  url?: string | { web?: string };
  license?: LicenseValue;
  licenses?: LicenseValue[];
  readme?: string;
  path?: string;
  realPath?: string;
  realName?: string;
  private?: boolean;
  root?: boolean;
  link?: string;
  extraneous?: boolean;
  depth?: number;
  invalid?: boolean;
  peerInvalid?: boolean;
  dependencies?: Record<string, DependencyPackage | string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  _dependencies?: Record<string, string>;
  parent?: DependencyPackage | null;
  target?: DependencyPackage;
  realpath?: string;
  children?: Map<string, DependencyPackage & { peer?: boolean }>;
  edgesOut?: Map<
    string,
    { type: string; spec: string; to?: DependencyPackage; valid: boolean }
  >;
  [key: string]: unknown;
}

export interface Clarification {
  semverRange: string;
  used?: boolean;
  checksum?: string;
  repository?: string;
  url?: string;
  path?: string;
  licenses?: LicenseValue[] | string;
  licenseFile?: string;
  licenseText?: string;
  licenseStart?: string;
  licenseEnd?: string;
  copyright?: string;
  publisher?: string;
  email?: string;
  [key: string]: unknown;
}

export type Clarifications = Record<string, Clarification[]>;
export type LicenseValue = string | { type?: string; name?: string };
export type LicenseCollectionOptions = Pick<
  LicenseCheckOptions,
  "customFormat" | "development" | "production" | "unknown"
> & {
  args?: Pick<LicenseCheckOptions, "csv">;
  basePath?: string | null;
  clarifications: Clarifications;
};

export interface ParsedArguments extends Omit<
  Partial<LicenseCheckOptions>,
  "direct" | "depth" | "color"
> {
  color?: boolean | null;
  depth?: string | number;
  direct?: string | boolean | number | null;
}

export interface NormalizedArguments extends LicenseCheckOptions {
  color: boolean;
  direct: number;
  relativeLicensePath: boolean;
  relativeModulePath: boolean;
}
