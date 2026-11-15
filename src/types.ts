export type DependencyScope = "production" | "development" | "both";

export interface DependencyLicense {
  name: string;
  version: string;
  license: string;
  scope: DependencyScope;
  packagePath: string;
  licenseFiles: string[];
}

export interface LicenseCheckOptions {
  start?: string;
  production?: boolean;
  development?: boolean;
  silent?: boolean;
  files?: string;
}

export interface PackageJson {
  name?: string;
  version?: string;
  license?: string | { type?: string };
  licenses?: Array<{ type?: string }>;
  dependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}
