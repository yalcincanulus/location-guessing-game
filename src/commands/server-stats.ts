import { getCountryDisplayName } from "../domain/countries/normalize-country-guess.ts";
import { getProvinceName } from "../domain/provinces/normalize-province-guess.ts";
import { messages } from "../i18n/messages.ts";
import type { ServerStats } from "../repositories/server-stats-repository.ts";

/** The text summary, used when the stats card cannot be rendered. */
export const formatServerStats = (stats: ServerStats) => {
  const top = stats.locations[0];
  const shared = {
    completedGames: stats.completedGames,
    totalGuesses: stats.totalGuesses,
    totalPlayers: stats.totalPlayers,
    oneshotGames: stats.oneshotGames,
    hosts: stats.hosts,
    participations: stats.participations,
  };
  return stats.mode === "province"
    ? messages.province.stats({
        ...shared,
        distinctProvinces: stats.locations.length,
        topProvinceName: top ? getProvinceName(top.code) : null,
        topProvinceGames: top?.count ?? 0,
      })
    : messages.commands.stats({
        ...shared,
        distinctCountries: stats.locations.length,
        topCountryName: top ? getCountryDisplayName(top.code, messages.locale) : null,
        topCountryGames: top?.count ?? 0,
      });
};
