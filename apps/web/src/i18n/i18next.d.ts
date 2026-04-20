import 'i18next';

import type enCommon from './locales/en/common.json';
import type enAuth from './locales/en/auth.json';
import type enFeed from './locales/en/feed.json';
import type enPost from './locales/en/post.json';
import type enProfile from './locales/en/profile.json';
import type enSpaces from './locales/en/spaces.json';
import type enTags from './locales/en/tags.json';

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'common';
    resources: {
      common: typeof enCommon;
      auth: typeof enAuth;
      feed: typeof enFeed;
      post: typeof enPost;
      profile: typeof enProfile;
      spaces: typeof enSpaces;
      tags: typeof enTags;
    };
  }
}
