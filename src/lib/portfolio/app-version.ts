/**
 * One JST stamp for the latest user-visible change.
 * On every feature, fix, or UI change, replace this with the time of that change.
 * Ver.YYMMDDHHMM and the Japanese date are both derived from it, so they cannot drift.
 * 2026-11-11 22:05 JST → Ver.2611112205
 */
export const APP_RELEASED_AT = "2026-11-11T22:05:00+09:00";

const STAMP = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\+09:00$/;

export function versionFromStamp(iso: string): { code: string; label: string } {
  const match = STAMP.exec(iso);
  if (!match) throw new Error("release stamp must be JST, YYYY-MM-DDTHH:MM:SS+09:00");
  const [, year, month, day, hour, minute] = match;
  return {
    code: `Ver.${year.slice(2)}${month}${day}${hour}${minute}`,
    label: `${Number(year)}年${Number(month)}月${Number(day)}日 ${hour}時${minute}分`,
  };
}

const current = versionFromStamp(APP_RELEASED_AT);

export const APP_VERSION = current.code;
export const APP_UPDATED_LABEL = current.label;
