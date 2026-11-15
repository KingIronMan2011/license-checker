declare module "@npmcli/arborist" {
  export interface ArboristEdge {
    type: string;
    spec: string;
    to?: ArboristNode;
    valid: boolean;
  }

  export interface ArboristNode {
    name?: string;
    version?: string;
    path: string;
    realpath?: string;
    package: Record<string, unknown>;
    root: ArboristNode;
    target?: ArboristNode;
    isLink?: boolean;
    peer?: boolean;
    children: Map<string, ArboristNode>;
    edgesOut: Map<string, ArboristEdge>;
  }

  export default class Arborist {
    constructor(options: { path: string });
    loadActual(): Promise<ArboristNode>;
  }
}

declare module "@npmcli/package-json" {
  const PackageJson: {
    prepare(path: string): Promise<{ content: Record<string, unknown> }>;
  };
  export default PackageJson;
}
