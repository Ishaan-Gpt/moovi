import { randomBytes } from 'node:crypto';

/** Short, URL- and graph-name-safe ids: a prefix letter and 14 lowercase hex characters (u… user, p… project, c… chat). */
export const newId = (prefix: string) => `${prefix}${randomBytes(7).toString('hex')}`;
