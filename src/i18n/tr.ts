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
    location: "Konum",
  },
  start: {
    gameChannelNotConfigured: "Oyun kanalı yapılandırılmamış.",
    configuredGameChannelUnavailable: "Yapılandırılmış oyun kanalına ulaşılamıyor.",
    activeGameAlreadyExists: "Zaten aktif bir oyun var.",
    couldNotExtractCoordinates: "Bu Google Haritalar bağlantısından koordinat çıkaramadım.",
    gameStarted: (userId, { inTheGame, coverageSource }) => {
      const coverageLine =
        coverageSource === "google"
          ? "**Kapsama:** Resmi Google Street View"
          : coverageSource === "third-party"
            ? "**Kapsama:** Üçüncü taraf / photosphere. Resmi görüntü değil."
            : "**Kapsama:** Bilinmiyor (bağlantıdan anlaşılamadı)";

      return [
        `<@${userId}> yeni bir konum oyunu başlattı. Ülkeyi tahmin etmek için ülke adını veya ISO kodunu yazın.`,
        inTheGame
          ? "**Oyunda:** Var. Bu ülkede resmi Google Street View var."
          : "**Oyunda:** Yok. Bu ülkede resmi Google Street View yok.",
        coverageLine,
      ].join("\n");
    },
    needsVerifiedRole: "Oyun başlatmak için doğrulanmış role sahip olman gerekiyor.",
    startingWaitingForScreenshot: (userId) =>
      `<@${userId}> yeni bir oyun başlatıyor. Ekran görüntüsü bekleniyor.`,
    startingWaitingForLink: (userId) =>
      `<@${userId}> yeni bir oyun başlatıyor. Google Haritalar bağlantısı bekleniyor.`,
    startReservationExpired: (userId, missing) =>
      missing === "screenshot"
        ? `<@${userId}> zamanında ekran görüntüsü eklemedi. Yeni bir oyun başlatılabilir.`
        : `<@${userId}> zamanında Google Haritalar bağlantısı eklemedi. Yeni bir oyun başlatılabilir.`,
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
      "Komutlar: `!map`, `!harita`, `!europe`, `!ss`, `!profile`, `!leaderboard`, `!stats`, `!daily`, `!weekly`, `!monthly`, `!seasonal`, `!yearly`, `!medals`.",
    helpTestCommands:
      "Test: `!test status`, `!test cancel`, `!test reveal`, `!test tick`, `!test reset`, `!test map`.",
  },
  awards: {
    liveHeader: (periodType, periodKey) => {
      const labels = {
        daily: "Günlük",
        weekly: "Haftalık",
        monthly: "Aylık",
        seasonal: "Mevsimlik",
        yearly: "Yıllık",
      } as const;
      return `**${labels[periodType]} sıralama** (${periodKey})`;
    },
    resultsHeader: (periodType, periodKey) => {
      const labels = {
        daily: "Günlük",
        weekly: "Haftalık",
        monthly: "Aylık",
        seasonal: "Mevsimlik",
        yearly: "Yıllık",
      } as const;
      return `**${labels[periodType]} ödüller** (${periodKey})`;
    },
    categoryTitle: (category) => {
      const labels = {
        points: "En Çok Puan",
        wins: "En Çok Galibiyet",
        started: "En Çok Başlatılan Oyun",
        hardest: "En İyi Oyun Kurucu",
      } as const;
      return `**${labels[category]}**`;
    },
    standingRow: (rank, displayName, value, medalEmoji) =>
      medalEmoji
        ? `${medalEmoji} ${rank}. ${displayName}: **${value}**`
        : `${rank}. ${displayName}: **${value}**`,
    noCategoryData: "_Henüz veri yok._",
    noMedalData: "Henüz madalya verilmedi.",
    medalRow: ({ rank, displayName, medalPoints, gold, silver, bronze }) =>
      `${rank}. ${displayName}: **${medalPoints}** puan (🥇${gold} 🥈${silver} 🥉${bronze})`,
    medalsHeader: "**Madalya sıralaması**",
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
  admin: {
    help: [
      "Admin komutları (yalnızca DM):",
      "`!admin help` — bu liste",
      "`!admin status` — aktif oyun / Redis-DB sapması",
      "`!admin cancel [sebep]` — aktif oyunu iptal et",
      "`!admin reveal` — cevabı ve koordinatları göster",
      "`!admin clear-start` — takılı başlangıç rezervasyonunu temizle",
      "`!admin reload` — kuralları veritabanından yenile",
      "`!admin tick` — boşta çarpan artışını zorla",
    ].join("\n"),
    gameChannelNotConfigured: "Oyun kanalı yapılandırılmamış.",
    gameChannelUnavailable: "Yapılandırılmış oyun kanalına ulaşılamıyor.",
    noActiveGame: "Oyun kanalında aktif oyun yok.",
    cancelledGame: (gameId) => `Oyun ${gameId} iptal edildi.`,
    cancelledAnnouncement: (gameId, reason) =>
      `Bu oyun bir admin tarafından iptal edildi (${gameId}). Sebep: ${reason}`,
    status: ({ game, wrongCountryCount, currentMultiplier, isTestGame, redisMissingButDbActive }) =>
      [
        "Admin durumu",
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
    clearStartDone: "Oyun kanalındaki başlangıç rezervasyonu ve bekleyen başlangıç temizlendi.",
    noStartState: "Oyun kanalında temizlenecek başlangıç rezervasyonu yok.",
    rulesReloaded: "Kurallar önbelleği veritabanından yenilendi.",
    multiplierCapped: (currentMultiplier) =>
      `Güncel çarpan zaten ${currentMultiplier.toFixed(2)}x sınırında.`,
    forcedMultiplierTick: (previousMultiplier, newMultiplier) =>
      `Çarpan elle artırıldı: ${previousMultiplier.toFixed(2)}x -> ${newMultiplier.toFixed(2)}x.`,
    multiplierNoChange: "Çarpan kontrolü aktif oyunu değiştirmedi.",
    unknownCommand:
      "Bilinmeyen admin komutu. `!admin help`, `status`, `cancel`, `reveal`, `clear-start`, `reload` veya `tick` kullan.",
  },
  game: {
    foundCountry: (userId, countryName) => `<@${userId}> ülkeyi buldu: **${countryName}**.`,
    locationDetails: ({ regionName, googleMapsUrl, latitude, longitude }) =>
      [
        regionName ? `Bölge: **${regionName}**` : undefined,
        `Koordinatlar: **${latitude.toFixed(5)}, ${longitude.toFixed(5)}**`,
        `Link: ${googleMapsUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
    testNoPoints: "Test oyunu: puan verilmedi.",
    reward: (points, basePoints, currentMultiplier, gmMultiplier) =>
      `Ödül: **${points}** puan (${basePoints} x ${currentMultiplier.toFixed(2)} x ${gmMultiplier.toFixed(2)}).`,
    osmAttribution:
      "Ters Coğrafi Kodlama verileri © [OpenStreetMap](https://www.openstreetmap.org/copyright) katkıda bulunanları tarafından sağlanır.",
  },
  jobs: {
    multiplierIncreased: (currentMultiplier) =>
      `Güncel çarpan **${currentMultiplier.toFixed(2)}x** oldu.`,
    channelIdleReminder:
      "Son bir saatte oyun başlatılmadı. Başlatmak için bu kanala bir **Google Haritalar bağlantısı** ve bir **ekran görüntüsü** gönderin, veya bota DM atın.",
  },
} satisfies BotMessages;
