export interface ThaiKnowledgeSource {
  name: string;
  url: string;
}

export interface ThaiKnowledgeEntity {
  id: string;
  domain: 'geo' | 'law' | 'history' | 'religion' | 'education';
  type: string;
  name_th: string;
  aliases: string[];
  description?: string;
  attributes?: Record<string, any>;
  relations?: Record<string, any>;
  source: ThaiKnowledgeSource[];
  confidence: number;
  version?: string;
  updated_at?: Date;
}

export interface ThaiGeoAttributes {
  region: string;
  lat: number;
  lon: number;
}

export interface ThaiGeoProvince extends Omit<ThaiKnowledgeEntity, 'attributes'> {
  domain: 'geo';
  type: 'province';
  attributes: ThaiGeoAttributes;
}
