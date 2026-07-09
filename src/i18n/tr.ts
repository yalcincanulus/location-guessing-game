import type { BotMessages } from "./types.ts";

export const trMessages = {
  locale: "tr",
  filenames: {
    fallbackScreenshot: "ekran-goruntusu.png",
    worldGuesses: "dunya-tahminleri.png",
  },
  mapLegend: {
    wrongGuesses: "Yanlış tahminler",
    correct: "Doğru",
  },
  start: {
    gameChannelNotConfigured: "Oyun kanalı yapılandırılmamış.",
    configuredGameChannelUnavailable: "Yapılandırılmış oyun kanalına ulaşılamıyor.",
    activeGameAlreadyExists: "Zaten aktif bir oyun var.",
    couldNotExtractCoordinates: "Bu Google Haritalar bağlantısından koordinat çıkaramadım.",
    gameStarted: (userId) =>
      `<@${userId}> yeni bir konum oyunu başlattı. Ülkeyi tahmin etmek için ülke adını veya ISO kodunu yazın.`,
    needsVerifiedRole: "Oyun başlatmak için doğrulanmış role sahip olman gerekiyor.",
    nowSendScreenshot: "Tamam. Oyunu başlatmak için şimdi ekran görüntüsünü gönder.",
    nowSendGoogleMapsLink:
      "Tamam. Oyunu başlatmak için şimdi Google Haritalar bağlantısını gönder.",
    sendLinkAndScreenshot:
      "Oyunu başlatmak için bir Google Haritalar bağlantısı ve ekran görüntüsü gönder.",
  },
  commands: {
    noActiveGameInChannel: "Bu kanalda aktif oyun yok.",
    couldNotLoadScreenshot: "Mevcut ekran görüntüsünü yükleyemedim.",
    noProfileYet: "Henüz profil yok.",
    profile: ({
      displayName,
      points,
      wins,
      participated,
      winRate,
      gamesStarted,
      guesses,
      gmMultiplier,
    }) =>
      [
        `**${displayName}**`,
        `Puan: **${points}**`,
        `Galibiyet: **${wins}** / Katılım: **${participated}** (${winRate}%)`,
        `Başlatılan oyun: **${gamesStarted}**`,
        `Tahmin: **${guesses}**`,
        `Oyun kurucu çarpanı: **${gmMultiplier.toFixed(2)}x**`,
      ].join("\n"),
    leaderboardRow: (rank, displayName, value) => `${rank}. ${displayName}: **${value}**`,
    noLeaderboardData: "Henüz liderlik verisi yok.",
    stats: ({ completedGames, totalGames, totalGuesses }) =>
      [
        `Oyunlar: **${completedGames}** tamamlandı / **${totalGames}** toplam`,
        `Toplam tahmin: **${totalGuesses}**`,
      ].join("\n"),
    helpCommands:
      "Komutlar: `!map`, `!harita`, `!europe`, `!ss`, `!profile`, `!leaderboard`, `!stats`.",
    helpTestCommands:
      "Test: `!test status`, `!test cancel`, `!test reveal`, `!test tick`, `!test reset`, `!test map`.",
  },
  test: {
    modeDisabled: "Test modu kapalı.",
    onlyInTestChannel: "Test araçları yalnızca yapılandırılmış test kanalında kullanılabilir.",
    notEnabledForUser: "Bu kanalda test araçlarını kullanma yetkin yok.",
    noActiveGameInTestChannel: "Bu test kanalında aktif oyun yok.",
    cancelledGame: (gameId) => `Test oyunu ${gameId} iptal edildi.`,
    resetGameState: "Test oyunu durumu sıfırlandı.",
    status: ({ game, wrongCountryCount, currentMultiplier, isTestGame, redisMissingButDbActive }) =>
      [
        "Test modu: **açık**",
        "Test kanalı: **evet**",
        "Komutu kullanan admin: **evet**",
        game ? `Oyun: **${game.id}** (${game.status})` : "Oyun: **yok**",
        game ? `Oyun kurucu: <@${game.gameMasterDiscordUserId}>` : undefined,
        `Yanlış ülkeler: **${wrongCountryCount}**`,
        `Güncel çarpan: **${currentMultiplier.toFixed(2)}x**`,
        `Test oyunu: **${isTestGame}**`,
        redisMissingButDbActive
          ? "Redis aktif oyun durumu yok, ancak veritabanında aktif bir oyun var."
          : undefined,
        game ? `Hedef: **${game.target}**` : undefined,
        game?.regionName ? `Bölge: **${game.regionName}**` : undefined,
      ]
        .filter(Boolean)
        .join("\n"),
    redisMissingButDbActive: "Redis aktif oyun durumu yok, ancak veritabanında aktif bir oyun var.",
    reveal: ({ redisMissingButDbActive, answer, regionName, latitude, longitude }) =>
      [
        redisMissingButDbActive
          ? "Redis aktif oyun durumu yok, ancak veritabanında aktif bir oyun var."
          : undefined,
        `Cevap: **${answer}**`,
        regionName ? `Bölge: **${regionName}**` : undefined,
        `Koordinatlar: **${latitude.toFixed(5)}, ${longitude.toFixed(5)}**`,
      ]
        .filter(Boolean)
        .join("\n"),
    multiplierCapped: (currentMultiplier) =>
      `Güncel çarpan zaten ${currentMultiplier.toFixed(2)}x sınırında.`,
    forcedMultiplierTick: (previousMultiplier, newMultiplier) =>
      `Çarpan elle artırıldı: ${previousMultiplier.toFixed(2)}x -> ${newMultiplier.toFixed(2)}x.`,
    multiplierNoChange: "Çarpan kontrolü aktif oyunu değiştirmedi.",
    sampleMap: (correctCountry, wrongCountries) =>
      [
        "Örnek harita çizimi:",
        `Doğru: **${correctCountry}**`,
        `Yanlış: **${wrongCountries.join(", ")}**`,
      ].join("\n"),
    unknownCommand:
      "Bilinmeyen test komutu. `!test status`, `cancel`, `reveal`, `tick`, `reset` veya `map` kullan.",
  },
  game: {
    foundCountry: (userId, countryName) => `<@${userId}> ülkeyi buldu: **${countryName}**.`,
    testNoPoints: "Test oyunu: puan verilmedi.",
    reward: (points, basePoints, currentMultiplier, gmMultiplier) =>
      `Ödül: **${points}** puan (${basePoints} x ${currentMultiplier.toFixed(2)} x ${gmMultiplier.toFixed(2)}).`,
    osmAttribution:
      "Konum verileri © [OpenStreetMap](https://www.openstreetmap.org/copyright) katkıda bulunanları tarafından sağlanır.",
  },
  jobs: {
    multiplierIncreased: (currentMultiplier) =>
      `Güncel çarpan **${currentMultiplier.toFixed(2)}x** oldu.`,
  },
} satisfies BotMessages;
