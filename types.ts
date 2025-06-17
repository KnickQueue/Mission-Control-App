
export enum ServiceStatus {
  OPERATIONAL = 'OPERATIONAL',
  OUTAGE = 'OUTAGE',
  CHECKING = 'CHECKING',
  UNKNOWN = 'UNKNOWN'
}

export interface Service {
  id: string;
  name: string;
  status: ServiceStatus;
  details: string | null;
  lastChecked: Date | null;
}

export interface GroundingChunkWeb {
  uri: string;
  title: string;
}

export interface GroundingChunk {
  web: GroundingChunkWeb;
}
    