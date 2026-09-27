export type PatreonCreator = {
  id: string;          // campaign ID
  patreonUserId?: string; // user/account ID (used for Pawchive)
  name: string;
  avatar?: string;
  url?: string;
};

export type PatreonPost = {
  id: string;
  title: string;
  thumbnail?: string;
  publishedAt?: string;
  isPaid: boolean;
  url?: string;
};
