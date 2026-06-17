export type InscriptionResult = {
  edcsId: string;
  inscriptionUri: string;
  placeLabel?: string;
  provinceLabel?: string;
  // Per-inscription coordinate carried straight from the index row, so the
  // map can cluster by the inscription's own lat/lon instead of looking the
  // place label up in a separate placeCoords table.
  lat?: number;
  lon?: number;
  datingFrom?: string;
  datingTo?: string;
  text?: string;
  publication?: string;
  persons?: string;
  careers?: string;
  benefactions?: string;
  relationships?: string;
  communities?: string;
};
