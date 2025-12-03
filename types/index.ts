export interface Location {
  latitude: number;
  longitude: number;
}

export interface Provider {
  id?: string | number;
  _id?: string;
  name?: string;
  firstname?: string;
  lastname?: string;
  profile_image_url?: string;
  location?: Location;
  [key: string]: any;
}

export interface MarkerData extends Provider {
  latitude: number;
  longitude: number;
  title?: string;
  time?: number;
}

export type { Provider as ProviderType };
