import { z } from 'zod';
import type { ZodErrorMap } from 'zod';
import i18n from './index';

function makeZodErrorMap(): ZodErrorMap {
  return (issue, ctx) => {
    const t = i18n.t.bind(i18n);

    switch (issue.code) {
      case z.ZodIssueCode.too_small:
        if (issue.type === 'string') {
          if (issue.minimum === 1) {
            return { message: t('zod.required', { ns: 'common', defaultValue: 'This field is required' }) };
          }
          return {
            message: t('zod.tooSmallString', {
              ns: 'common',
              defaultValue: `Must be at least ${issue.minimum} characters`,
              minimum: issue.minimum,
            }),
          };
        }
        return { message: ctx.defaultError };

      case z.ZodIssueCode.too_big:
        if (issue.type === 'string') {
          return {
            message: t('zod.tooBigString', {
              ns: 'common',
              defaultValue: `Must be at most ${issue.maximum} characters`,
              maximum: issue.maximum,
            }),
          };
        }
        return { message: ctx.defaultError };

      case z.ZodIssueCode.invalid_type:
        if (issue.received === 'undefined') {
          return { message: t('zod.required', { ns: 'common', defaultValue: 'This field is required' }) };
        }
        return { message: ctx.defaultError };

      case z.ZodIssueCode.invalid_string:
        if (issue.validation === 'email') {
          return { message: t('zod.invalidEmail', { ns: 'common', defaultValue: 'Invalid email address' }) };
        }
        if (issue.validation === 'url') {
          return { message: t('zod.invalidUrl', { ns: 'common', defaultValue: 'Invalid URL' }) };
        }
        return { message: ctx.defaultError };

      default:
        return { message: ctx.defaultError };
    }
  };
}

export function installZodErrorMap() {
  z.setErrorMap(makeZodErrorMap());
}

/** Re-installs the error map whenever language changes */
export function setupZodI18nSync() {
  installZodErrorMap();
  i18n.on('languageChanged', () => {
    installZodErrorMap();
  });
}
