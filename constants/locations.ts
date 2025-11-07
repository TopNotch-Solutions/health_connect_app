// In constants/locations.ts

export const namibianRegions = [
  { label: 'Erongo', value: 'Erongo' },
  { label: 'Hardap', value: 'Hardap' },
  { label: 'Karas', value: 'Karas' },
  { label: 'Kavango East', value: 'Kavango East' },
  { label: 'Kavango West', value: 'Kavango West' },
  { label: 'Khomas', value: 'Khomas' },
  { label: 'Kunene', value: 'Kunene' },
  { label: 'Ohangwena', value: 'Ohangwena' },
  { label: 'Omaheke', value: 'Omaheke' },
  { label: 'Omusati', value: 'Omusati' },
  { label: 'Oshana', value: 'Oshana' },
  { label: 'Oshikoto', value: 'Oshikoto' },
  { label: 'Otjozondjupa', value: 'Otjozondjupa' },
  { label: 'Zambezi', value: 'Zambezi' },
];

export const townsByRegion: { [key: string]: { label: string; value: string }[] } = {
  Erongo: [
    { label: 'Swakopmund', value: 'Swakopmund' },
    { label: 'Walvis Bay', value: 'Walvis Bay' },
    { label: 'Henties Bay', value: 'Henties Bay' },
    { label: 'Omaruru', value: 'Omaruru' },
  ],
  Hardap: [
    { label: 'Mariental', value: 'Mariental' },
    { label: 'Rehoboth', value: 'Rehoboth' },
  ],
  Karas: [
    { label: 'Keetmanshoop', value: 'Keetmanshoop' },
    { label: 'Lüderitz', value: 'Lüderitz' },
  ],
  'Kavango East': [
    { label: 'Rundu', value: 'Rundu' },
  ],
  'Kavango West': [
    { label: 'Nkurenkuru', value: 'Nkurenkuru' },
  ],
  Khomas: [
    { label: 'Windhoek', value: 'Windhoek' },
  ],
  Kunene: [
    { label: 'Opuwo', value: 'Opuwo' },
    { label: 'Khorixas', value: 'Khorixas' },
  ],
  Ohangwena: [
    { label: 'Eenhana', value: 'Eenhana' },
    { label: 'Helao Nafidi', value: 'Helao Nafidi' },
  ],
  Omaheke: [
    { label: 'Gobabis', value: 'Gobabis' },
  ],
  Omusati: [
    { label: 'Outapi', value: 'Outapi' },
  ],
  Oshana: [
    { label: 'Oshakati', value: 'Oshakati' },
    { label: 'Ongwediva', value: 'Ongwediva' },
  ],
  Oshikoto: [
    { label: 'Tsumeb', value: 'Tsumeb' },
    { label: 'Omuthiya', value: 'Omuthiya' },
  ],
  Otjozondjupa: [
    { label: 'Otjiwarongo', value: 'Otjiwarongo' },
    { label: 'Okahandja', value: 'Okahandja' },
    { label: 'Grootfontein', value: 'Grootfontein' },
  ],
  Zambezi: [
    { label: 'Katima Mulilo', value: 'Katima Mulilo' },
  ],
};