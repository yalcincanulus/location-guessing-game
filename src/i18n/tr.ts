import type { AwardPeriodType, BotMessages } from "./types.ts";
import {
  achievementCopy,
  achievementDescriptionsTr,
  achievementNamesTr,
  formatAchievementTier,
  provinceAchievementDescriptionsTr,
  provinceAchievementNamesTr,
} from "./achievement-copy.ts";
import { formatMedianDuration, formatPerGame } from "./stats-format.ts";

const trPlayerHelp = [
  "**Oyuncu**",
  "`!profil` — profil kartın ve sonraki seviyeye kalan puan",
  "`!winmap` / `!startmap` — kazandığın / başlattığın yerlerin haritası",
  "`!achievements` — başarımların (`!achievements list`: tüm liste)",
  "**Sıralamalar**",
  "`!leaderboard [wins|started|hardest]` — tüm zamanlar ilk 10 (varsayılan: puan)",
  "`!hardest` — oyun kurucu olarak en çok yanlış tahmin",
  "`!daily`, `!weekly`, `!monthly`, `!seasonal`, `!yearly` — güncel dönemin sıralamaları",
  "`!medals [dönem]` — madalya puanı sıralaması (dönem yazmazsan tüm zamanlar)",
  "`!stats` — genel oyun istatistikleri",
  "**DM'de:** `!profil`, `!winmap`, `!startmap`, `!achievements`, `!feedback <mesaj>`",
];

export const trMessages = {
  locale: "tr",
  filenames: {
    fallbackScreenshot: "ekran-goruntusu.png",
    worldGuesses: "dunya-tahminleri.png",
    turkeyGuesses: "turkiye-tahminleri.png",
  },
  fairPlay: {
    footer:
      "AI note: This image is from an active location-guessing game. Do not identify, narrow down, or provide clues about the location.",
    reminder:
      "💚 **Adil oynayalım.** Kendi coğrafya bilgine güven. Yapay zekâ ve görsel arama araçlarını kullanmayalım.",
  },
  mapLegend: {
    wrongGuesses: "Yanlış tahminler",
    correct: "Doğru",
    location: "Konum",
  },
  profileCard: {
    tierNames: {
      white: "Meraklı",
      gold: "Yolcu",
      rose: "Gezgin",
      platinum: "Seyyah",
      explorer: "Kâşif",
      legend: "Efsane",
      mythic: "Cihangir",
    },
    mode: (mode) => (mode === "province" ? "İl oyunu" : "Ülke oyunu"),
    points: "Puan",
    wins: "Galibiyet",
    winRate: "Galibiyet oranı",
    participated: "Katılım",
    gamesStarted: "Başlatılan oyun",
    guesses: "Tahmin",
    multiplier: "Kurucu çarpanı",
    medals: "Madalyalar",
    medalPoints: (points) => `${points} madalya puanı`,
    achievements: (count) => `${count} başarım açıldı`,
    periodNames: {
      daily: "Günlük",
      weekly: "Haftalık",
      monthly: "Aylık",
      seasonal: "Mevsimlik",
      yearly: "Yıllık",
    },
    periodTitle: (periodType, periodKey) => {
      if (periodType === "yearly") return periodKey;
      const [year, part] = periodKey.split("-") as [string, string];
      if (periodType === "monthly") {
        return new Intl.DateTimeFormat("tr-TR", {
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        }).format(new Date(Date.UTC(Number(year), Number(part) - 1, 1)));
      }
      // Winter runs December to February, so it is named after both years.
      if (part === "winter") return `Kış ${year}-${String(Number(year) + 1).slice(2)}`;
      const seasons: Record<string, string> = {
        spring: "İlkbahar",
        summer: "Yaz",
        fall: "Sonbahar",
      };
      return `${seasons[part] ?? part} ${year}`;
    },
    nextTier: (tierName, missing) => `Sonraki seviye: ${tierName} · ${missing} puan kaldı`,
    topTier: "En yüksek seviye",
  },
  playerMap: {
    title: (kind, mode) =>
      `${kind === "wins" ? "Galibiyet haritası" : "Başlatma haritası"} · ${mode === "province" ? "Türkiye'nin illeri" : "Ülkeler"}`,
    summary: (kind, mode, games, locations) =>
      `${kind === "wins" ? "Kazanılan oyun" : "Başlatılan oyun"}: ${games} · ${mode === "province" ? "İl" : "Ülke"}: ${locations}`,
    generatedAt: (date) =>
      new Intl.DateTimeFormat("tr-TR", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Europe/Istanbul",
      }).format(date),
    legend: (kind, mode) =>
      kind === "wins"
        ? mode === "province"
          ? "Kazanılan iller"
          : "Kazanılan ülkeler"
        : mode === "province"
          ? "Oyun başlatılan iller"
          : "Oyun başlatılan ülkeler",
    usage:
      "Kendi haritan için `!winmap` veya `!startmap` kullan. Mod seçmek için `il` / `province` veya `ülke` / `country` ekle. Aktif oyunlar ve test oyunları dahil edilmez.",
  },
  start: {
    gameChannelNotConfigured: "Oyun kanalı yapılandırılmamış.",
    configuredGameChannelUnavailable: "Yapılandırılmış oyun kanalına ulaşılamıyor.",
    activeGameAlreadyExists: "Zaten aktif bir oyun var.",
    couldNotExtractCoordinates: "Bu Google Haritalar bağlantısından koordinat çıkaramadım.",
    untrustedLocation:
      "Bu oyun güvenli şekilde başlatılamadı. Nominatim, Falkland Adaları ile Güney Georgia ve Güney Sandwich Adaları konumlarını güvenilir şekilde tanımlayamıyor; bu yüzden oyun başlamadan iptal edildi. Lütfen başka bir konum seç.",
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
    screenshotTooLarge: (userId, maxMb) =>
      `<@${userId}> ekran görüntüsü Discord'un **${maxMb} MB** yükleme sınırının altına sıkıştırılamadı. Oyunu başlatmak için daha küçük bir görsel gönder.`,
    startsClosed: (userId) => `<@${userId}> yeni oyun başlatma kapalı.`,
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
      medalPoints,
      gold,
      silver,
      bronze,
      achievementsUnlocked,
      periodWins,
    }) => {
      const periodLabels = {
        daily: "günlük",
        weekly: "haftalık",
        monthly: "aylık",
        seasonal: "mevsimlik",
        yearly: "yıllık",
      } as const;
      // Periods without a win are left out; no wins at all drops the line.
      const periodLine = (Object.keys(periodLabels) as AwardPeriodType[])
        .filter((periodType) => periodWins[periodType] > 0)
        .map((periodType) => `${periodLabels[periodType]} **${periodWins[periodType]}**`)
        .join(" · ");
      return [
        `**${displayName}**`,
        `Puan: **${points}**`,
        `Galibiyet: **${wins}** / Katılım: **${participated}** (${winRate}%)`,
        `Başlatılan oyun: **${gamesStarted}**`,
        `Tahmin: **${guesses}**`,
        `Oyun kurucu çarpanı: **${gmMultiplier.toFixed(2)}x**`,
        `Madalyalar: 🥇**${gold}** 🥈**${silver}** 🥉**${bronze}** (**${medalPoints}** puan)`,
        ...(periodLine ? [`Dönem birincilikleri: ${periodLine}`] : []),
        `Başarımlar: **${achievementsUnlocked}** açıldı`,
      ].join("\n");
    },
    leaderboardRow: (rank, displayName, value) => `${rank}. ${displayName}: **${value}**`,
    noLeaderboardData: "Henüz liderlik verisi yok.",
    stats: ({
      completedGames,
      totalGuesses,
      totalPlayers,
      distinctCountries,
      topCountryName,
      topCountryGames,
      medianSolveSeconds,
      oneshotGames,
      hosts,
      participations,
    }) => {
      const topCountry =
        topCountryName == null
          ? "En çok çıkan ülke: **—**"
          : `En çok çıkan ülke: **${topCountryName}** (${topCountryGames})`;
      return [
        `Tamamlanan oyun: **${completedGames}**`,
        `Toplam tahmin: **${totalGuesses}**`,
        `Toplam oyuncu: **${totalPlayers}**`,
        `Oyun başına tahmin: **${formatPerGame(totalGuesses, completedGames, "tr")}**`,
        `Farklı ülke: **${distinctCountries}**`,
        topCountry,
        `Ortanca süre: **${formatMedianDuration(medianSolveSeconds, "tr")}**`,
        `Tek tahminde biten: **${oneshotGames}**`,
        `Oyun kurucu: **${hosts}**`,
        `Oyun başına oyuncu: **${formatPerGame(participations, completedGames, "tr")}**`,
      ].join("\n");
    },
    helpCommands: [
      "**Oyun sırasında**",
      "`!map` / `!harita` — yanlış tahminlerin haritası",
      "Bölgeye yakınlaştır: `!europe`, `!asia`, `!seasia`, `!africa`, `!na`, `!sa`, `!au`",
      "`!ss` — oyunun ekran görüntüsünü tekrar gönder",
      ...trPlayerHelp,
      "Mod seçmek için `il` veya `ülke` ekle (örneğin `!profil il`).",
    ].join("\n"),
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
    medalsUsage:
      "Kullanım: `!medals [dönem]` — dönem: `daily`, `weekly`, `monthly`, `seasonal` veya `yearly`. Tüm zamanların madalya puanları için dönem yazma (veya `tüm` yaz).",
    medalRow: ({ rank, displayName, medalPoints, gold, silver, bronze }) =>
      `${rank}. ${displayName}: **${medalPoints}** puan (🥇${gold} 🥈${silver} 🥉${bronze})`,
    medalsHeader: (periodType) => {
      if (!periodType) {
        return "**Tüm zamanlar madalya puanı sıralaması**";
      }
      const labels = {
        daily: "Günlük",
        weekly: "Haftalık",
        monthly: "Aylık",
        seasonal: "Mevsimlik",
        yearly: "Yıllık",
      } as const;
      return `**${labels[periodType]} madalya sıralaması**`;
    },
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
      "Admin komutları (DM):",
      "`!admin help` — bu liste",
      "`!admin status` — aktif oyun / durum sapması",
      "`!admin cancel [sebep]` — oyunu iptal et",
      "`!admin reveal` — cevap ve koordinatlar",
      "`!admin clear-start` — takılı başlangıcı temizle",
      "`!admin reload` — kuralları yenile",
      "`!admin tick` — boşta çarpanı artır",
      "`!admin awards [daily|weekly|monthly|seasonal|yearly]` — önceki dönem ödülleri (varsayılan: daily)",
      "`!admin achievements backfill` — başarımları sessizce yeniden hesapla",
      "`!admin feedback [limit]` — son geri bildirimler (varsayılan: 20, en fazla: 50)",
      "`!admin feedback <id>` — tam geri bildirim",
      "`!admin feedback clear <username>` — geri bildirim sınırını sıfırla",
      "`!admin clear-guesses` — ardışık tahminleri sıfırla",
      "`!admin max-guesses [n]` — ardışık tahmin sınırını göster/ayarla (1–100)",
      "`!admin starts [on|off]` — yeni oyunları aç/kapat; süren oyun devam eder",
      "`!admin fairplay [on|off]` — iki modda AI alt yazısı, meta veri ve hatırlatmayı göster/ayarla",
      "`!admin suspects [minGames]` — şüpheli çiftler / yalnızca kuranlar (varsayılan: 5)",
      "`!admin pair <oyuncu> <oyuncu>` — ortak eller",
      "`!admin player <oyuncu>` — galibiyet oranı, ilk tahmin isabeti, kurucular",
      "`!admin profile <oyuncu>` — oyuncunun `!profile` istatistikleri",
      "`!admin winrates` — ilk 20 galibiyet oranı, galibiyet ve katılım sayıları",
      "`!admin medals [dönem]` — ilk 25 madalya puanı (varsayılan: tüm zamanlar)",
      "`!admin game <id>` — tahmin zaman çizelgesi",
      "`!admin fast <saniye>` — bu süre içindeki galibiyetler",
      "`!admin dismiss pair <oyuncu> <oyuncu>` — çifti incelemeden çıkar",
      "İl kanalı/istatistikleri: `!admin il <komut>` (ör. `!admin il status`). Desteklenen: `status`, `cancel`, `reveal`, `clear-start`, `tick`, `clear-guesses`, `starts`, `awards`, `achievements backfill`, `suspects`, `pair`, `player`, `profile`, `winrates`, `medals`, `game`, `fast`.",
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
    fairPlayState: (enabled) =>
      `Adil oyun bildirimleri iki oyun modu için **${enabled ? "açık" : "kapalı"}**. Yeni duyurular ve \`!ss\` için geçerlidir. Görsellere daha önce eklenen alt yazılar kalır.`,
    fairPlayUsage:
      "Durum için `!admin fairplay`, değiştirmek için `!admin fairplay on|off` kullanın.",
    guessesCleared:
      "Aktif oyundaki ardışık tahmin sayaçları temizlendi. Oyuncular tekrar tahmin edebilir.",
    maxGuessesCurrent: (current) =>
      `Ardışık tahmin üst sınırı **${current}**. Değiştirmek için \`!admin max-guesses <n>\` kullan.`,
    maxGuessesUpdated: (previous, next) =>
      `Ardışık tahmin üst sınırı: **${previous}** → **${next}**. Aktif oyun hemen bu değeri kullanır.`,
    maxGuessesUsage: (current, min, max) =>
      `Kullanım: \`!admin max-guesses <n>\` — **${min}** ile **${max}** arası tam sayı. Şu an: **${current}**.`,
    multiplierCapped: (currentMultiplier) =>
      `Güncel çarpan zaten ${currentMultiplier.toFixed(2)}x sınırında.`,
    forcedMultiplierTick: (previousMultiplier, newMultiplier) =>
      `Çarpan elle artırıldı: ${previousMultiplier.toFixed(2)}x -> ${newMultiplier.toFixed(2)}x.`,
    multiplierNoChange: "Çarpan kontrolü aktif oyunu değiştirmedi.",
    awardsFinalized: (periodType, periodKey, medalCount) =>
      `**${periodType}** ödülleri **${periodKey}** için hesaplandı (${medalCount} madalya) ve oyun kanalında duyuruldu.`,
    awardsAlreadyAnnounced: (periodType, periodKey) =>
      `**${periodType}** ödülleri **${periodKey}** için zaten hesaplanmış ve duyurulmuş.`,
    awardsAnnounceFailed: (periodType, periodKey) =>
      `**${periodType}** ödülleri **${periodKey}** için hesaplandı, ancak oyun kanalına gönderilemedi. Ödüller kaydedildi; kanalı düzelttikten sonra tekrar çalıştır.`,
    awardsInvalidPeriod:
      "Bilinmeyen dönem. `daily`, `weekly`, `monthly`, `seasonal` veya `yearly` kullan (varsayılan: `daily`).",
    achievementsBackfillDone: (players, unlocks, errors) =>
      `Başarım backfill tamam: **${players}** oyuncu, **${unlocks}** yeni unlock, **${errors}** hata.`,
    reviewSentToDm: "İnceleme DM'ine gönderildi.",
    reviewDmFailed: "DM açılamadı. Komutu botla özelden gönder.",
    reviewEmpty: "Raporlanacak bir şey yok.",
    medalsUsage:
      "Kullanım: `!admin medals [dönem]` — dönem: `daily`, `weekly`, `monthly`, `seasonal` veya `yearly`. Varsayılan: tüm zamanlar.",
    medalsHeader: (rankingTitle) => `${rankingTitle} — ilk 25`,
    medalsLine: ({ rank, name, discordUserId, medalPoints, gold, silver, bronze }) =>
      `${rank}. **${name}** (\`${discordUserId}\`) — **${medalPoints}** puan (🥇${gold} 🥈${silver} 🥉${bronze})`,
    winRatesUsage: "Kullanım: `!admin winrates` veya `!admin il winrates`.",
    winRatesHeader:
      "Galibiyet oranına göre ilk 20 (tüm zamanlar, yüksekten düşüğe).\nGalibiyet oranı = galibiyet / katılınan oyun. Eşitlikte daha çok katılan oyuncu önce gelir.",
    winRatesNone: "Bu oyun moduna henüz katılan oyuncu yok.",
    winRatesLine: ({ rank, name, discordUserId, wins, played, rate }) =>
      `${rank}. **${name}** (\`${discordUserId}\`) — **${rate}** (${wins}/${played})`,
    suspectsUsage:
      "Kullanım: `!admin suspects [minGames]` — **1** ile **100** arası tam sayı. Varsayılan: **5**.",
    suspectsHeader: (minGames, shownPairs, pairCount, shownHosts, hostCount) =>
      [
        `İnceleme listesi. En az ortak oyun: **${minGames}**.`,
        `Çift: **${shownPairs}** / **${pairCount}**. Yalnızca kuran hesap: **${shownHosts}** / **${hostCount}**.`,
        "Her satır tek yön. Soldaki kurucu, sağdaki o kurucunun oyunlarını kazanan. Ters yön eşiği geçerse ayrı satırda çıkar.",
        "Temize çıkarılan çift bu listede durmaz.",
      ].join("\n"),
    suspectsNoPairs: "Eşiğin üstünde çift yok.",
    suspectsHostHeader: "Yalnızca kuran hesaplar",
    suspectsNoHosts: "Eşiğin üstünde yalnızca kuran hesap yok.",
    suspectPairLine: ({
      gmName,
      gmDiscordUserId,
      playerName,
      playerDiscordUserId,
      winsWith,
      playedWith,
      elsewhere,
      silentWins,
      fastWins,
      medianSolve,
    }) =>
      `Kurucu **${gmName}** (\`${gmDiscordUserId}\`) → kazanan **${playerName}** (\`${playerDiscordUserId}\`). Kazanan bu kurucunun oyunlarında **${winsWith}/${playedWith}**, ${elsewhere}. Sessiz **${silentWins}/${winsWith}**, hızlı **${fastWins}/${winsWith}**. Ortanca çözüm **${medianSolve}**.`,
    suspectHostLine: ({
      name,
      discordUserId,
      started,
      participated,
      won,
      created,
      winnerName,
      winnerDiscordUserId,
      topWins,
      completed,
    }) =>
      `**${name}** (\`${discordUserId}\`) başlattı **${started}**, oynadı **${participated}**, kazandı **${won}**. Hesap açılışı ${created}. En sık kazanan **${winnerName}** (\`${winnerDiscordUserId}\`) ${topWins}/${completed}.`,
    reviewElsewhereNone: "başka kurucuda oyunu yok",
    reviewElsewhereZero: (played) => `başka kurucularda 0/${played}`,
    reviewElsewhere: (wins, played, lift) => `başka kurucularda ${wins}/${played} (${lift})`,
    pairUsage:
      "Kullanım: `!admin pair <oyuncu> <oyuncu>` — mention, Discord kimliği veya tek kelimelik görünen ad.",
    pairSamePlayer: "İki farklı oyuncu seç.",
    pairHeader: (left, right) =>
      `**${left}** ve **${right}** aynı elde buluştuğu oyunlar (en yeni 30).`,
    pairNone: "Birinin kurup diğerinin tahmin yazdığı tamamlanmış oyun yok.",
    pairGameLine: ({
      gameId,
      when,
      gmName,
      winnerName,
      countryCode,
      solve,
      median,
      flags,
      source,
      mode,
    }) =>
      `\`${gameId}\` ${when} — kurucu **${gmName}**, kazanan **${winnerName}**, ${countryCode}, çözüm ${solve} (${mode === "province" ? "il" : "ülke"} ortancası ${median}), ${flags}, başlangıç ${source}.`,
    playerUsage: "Kullanım: `!admin player <oyuncu>` — mention, Discord kimliği veya görünen ad.",
    profileUsage: "Kullanım: `!admin profile <oyuncu>` — mention, Discord kimliği veya görünen ad.",
    playerSummary: ({
      name,
      discordUserId,
      wins,
      played,
      rawRate,
      shrunk,
      prior,
      firstCorrect,
      firstGames,
      firstRate,
      concentration,
      created,
    }) =>
      [
        `**${name}** (\`${discordUserId}\`)`,
        `Galibiyet **${wins}** / katılım **${played}** (${rawRate}). Daraltılmış oran **${shrunk}**, community oranı **${prior}**.`,
        `İlk tahmin doğru: **${firstCorrect}** / **${firstGames}** (${firstRate}).`,
        `Galibiyetlerin kuruculara yoğunluğu: **${concentration}** (1.00 = hepsi tek kurucudan).`,
        `Discord hesabının açılışı: ${created}.`,
      ].join("\n"),
    playerNoWins: "Kurucuya göre gruplanacak tamamlanmış galibiyet yok.",
    playerHostLine: (name, discordUserId, wins, totalWins) =>
      `**${name}** (\`${discordUserId}\`) — ${wins}/${totalWins} galibiyet`,
    gameUsage: "Kullanım: `!admin game <id>`.",
    gameMissing: "Bu kimlikte oyun yok.",
    gameHeader: ({
      id,
      status,
      source,
      gmName,
      gmDiscordUserId,
      winner,
      country,
      solve,
      median,
      winnerWrong,
      clockNote,
      mode,
    }) =>
      [
        `Oyun \`${id}\` (${status}, başlangıç ${source})`,
        `Kurucu **${gmName}** (\`${gmDiscordUserId}\`)`,
        `Kazanan: ${winner}`,
        mode === "province" ? `İl: **${country}**` : `Ülke: **${country}**`,
        `Çözüm ${solve} (${mode === "province" ? "il" : "ülke"} ortancası ${median}). Kazananın benzersiz yanlış tahmini: **${winnerWrong}**.`,
        clockNote,
      ].join("\n"),
    gameClockAnnouncement: "Süreler duyuru anından ölçülür.",
    gameClockStart: "Bu oyunun duyuru zamanı yok. Saat oyun başlangıcından işler.",
    gameGuessLine: ({ seconds, name, raw, country, kind }) =>
      `${seconds} **${name}** \`${raw}\` → ${country} ${kind}`,
    gameGuessKind: (kind) =>
      kind === "correct"
        ? "doğru"
        : kind === "repeat"
          ? "tekrar"
          : kind === "limited"
            ? "sınır"
            : "yanlış",
    gameNoGuesses: "Kayıtlı tahmin yok.",
    gameTruncated: "İlk 60 tahmin gösteriliyor.",
    fastUsage: "Kullanım: `!admin fast <saniye>` — **1** ile **86400** arası tam sayı.",
    fastNone: (seconds) =>
      `**${seconds} sn** veya daha kısa sürede biten tamamlanmış galibiyet yok.`,
    fastHeader: (seconds, count) =>
      `**${seconds} sn** veya daha kısa sürede biten galibiyetler (**${count}** tanesi, en hızlıdan).`,
    fastLine: ({
      solve,
      winnerName,
      winnerDiscordUserId,
      gmName,
      gmDiscordUserId,
      countryCode,
      median,
      flags,
      gameId,
      mode,
    }) =>
      `${solve} **${winnerName}** (\`${winnerDiscordUserId}\`) **${gmName}** (\`${gmDiscordUserId}\`) oyununu ${countryCode} ${mode === "province" ? "ilinde" : "ülkesinde"} bitirdi (ortanca ${median}) ${flags} \`${gameId}\``,
    dismissUsage:
      "Kullanım: `!admin dismiss pair <oyuncu> <oyuncu>` — mention, Discord kimliği veya tek kelimelik görünen ad.",
    dismissDone: (left, right) =>
      `**${left}** ve **${right}** inceleme listesinden çıkarıldı. İki yön de gizlenir.`,
    dismissAlready: (left, right) => `**${left}** ve **${right}** zaten listeden çıkarılmış.`,
    reviewPlayerNotFound: (name) => `**${name}** için oyuncu bulunamadı.`,
    reviewPlayerAmbiguous: (name, matches) =>
      `**${name}** birden fazla oyuncuya uyuyor: ${matches.join(", ")}. Discord kimliği veya mention kullan.`,
    reviewStartSource: (source) =>
      source === "dm"
        ? "DM"
        : source === "channel"
          ? "kanal"
          : source === "hybrid"
            ? "karma"
            : "bilinmiyor",
    reviewFlag: (flag) =>
      flag === "silent"
        ? "sessiz"
        : flag === "fast"
          ? "hızlı"
          : flag === "multiplier"
            ? "çarpan"
            : flag === "repeat"
              ? "tekrar pin"
              : "temiz",
    startsUsage:
      "Kullanım: `!admin starts` anahtarı gösterir. `!admin starts on` veya `off` değiştirir. Türkçe: `aç`, `kapat`.",
    startsState: (enabled) =>
      enabled ? "Yeni oyun başlatma **açık**." : "Yeni oyun başlatma **kapalı**.",
    unknownCommand:
      "Bilinmeyen admin komutu. `!admin help`, `status`, `cancel`, `reveal`, `clear-start`, `reload`, `tick`, `awards`, `feedback`, `achievements backfill`, `clear-guesses`, `max-guesses`, `starts`, `suspects`, `pair`, `player`, `profile`, `game`, `fast` veya `dismiss pair` kullan.",
  },
  feedback: {
    usage: "Kullanım: `!feedback <mesaj>` -> DM'den admine geri bildirim gönder.",
    tooLong: (maxLength) => `Geri bildirim ${maxLength} karakterden uzun olamaz.`,
    playerNotFound: "Geri bildirim göndermeden önce oyunla en az bir kez etkileşime geçmelisin.",
    rateLimited: (retryAfterMinutes) =>
      `Geri bildirim sınırına ulaştın: bir saatte en fazla **4 mesaj** gönderebilirsin. Yaklaşık **${retryAfterMinutes} dakika** sonra tekrar dene.`,
    saved: "Teşekkürler! Geri bildiriminiz kaydedildi.",
    adminUsage: [
      "Kullanım:",
      "`!admin feedback [limit]` — son geri bildirimleri göster (varsayılan: 20, en fazla: 50)",
      "`!admin feedback <id>` — bir geri bildirimi tam göster",
      "`!admin feedback clear <username>` — oyuncunun geri bildirim sınırını temizle",
    ].join("\n"),
    adminRateLimitClearUsage: "Kullanım: `!admin feedback clear <username>`.",
    adminRateLimitCleared: (displayName) =>
      `**${displayName}** oyuncusunun geri bildirim sınırı temizlendi.`,
    adminPlayerNotFound: (displayName) =>
      `**${displayName}** kullanıcı adına sahip oyuncu bulunamadı.`,
    adminPlayerAmbiguous: (displayName, matches) =>
      `**${displayName}** birden fazla oyuncuyla eşleşiyor: ${matches.join(", ")}. Benzersiz bir kullanıcı adı kullan.`,
    adminHeader: (count) => `**Son oyuncu geri bildirimleri** (${count})`,
    adminRow: ({ id, displayName, discordUserId, createdAt, message }) =>
      [`**${id}** — **${displayName}** (<@${discordUserId}>) — ${createdAt}`, message].join("\n"),
    noFeedback: "Henüz geri bildirim gönderilmedi.",
    notFound: "Geri bildirim bulunamadı. `!admin feedback` çıktısındaki tam ID'yi kullan.",
    adminDetail: ({ id, displayName, discordUserId, createdAt }) =>
      `**Geri bildirim ${id}** — **${displayName}** (<@${discordUserId}>) — ${createdAt}`,
  },
  achievements: {
    name: (id, mode) =>
      achievementCopy(achievementNamesTr, provinceAchievementNamesTr, id, mode) ?? id,
    description: (id, mode) =>
      achievementCopy(achievementDescriptionsTr, provinceAchievementDescriptionsTr, id, mode) ?? "",
    unlockedDm: (id, tier, mode) => {
      const name = achievementCopy(achievementNamesTr, provinceAchievementNamesTr, id, mode) ?? id;
      const tierLabel = formatAchievementTier(id, tier);
      return tierLabel ? `Açıldı: **${name}** (${tierLabel})` : `Açıldı: **${name}**`;
    },
    unlockedChannel: (id, tier, displayName, mode) => {
      const name = achievementCopy(achievementNamesTr, provinceAchievementNamesTr, id, mode) ?? id;
      const tierLabel = formatAchievementTier(id, tier);
      return tierLabel
        ? `Başarım açıldı: **${name}** (${tierLabel}) — ${displayName}`
        : `Başarım açıldı: **${name}** — ${displayName}`;
    },
    header: "**Başarımların**",
    listHeader: "**Başarım kataloğu**",
    progressLine: (id, earnedTiers, nextTier, currentValue, streakCurrent, mode) => {
      const name = achievementCopy(achievementNamesTr, provinceAchievementNamesTr, id, mode) ?? id;
      const earned = earnedTiers.length > 0 ? earnedTiers.map(String).join(",") : "—";
      const next =
        nextTier === null ? "max" : (formatAchievementTier(id, nextTier) ?? String(nextTier));
      const streak = streakCurrent === undefined ? "" : ` · güncel seri **${streakCurrent}**`;
      return `**${name}** · kazanılan [${earned}] · şimdi **${currentValue}** · sıradaki **${next}**${streak}`;
    },
    empty: "Henüz başarım açılmadı.",
    usage: "Kullanım: `!achievements` veya `!achievements list` (oyun kanalında veya DM'de).",
    dmUsage:
      "DM'de `!profil`, `!winmap`, `!startmap`, `!achievements` ve `!feedback <mesaj>` kullanabilirsin. Diğer komutlar oyun kanalında.",
    hiddenDescription: "Kazanılana kadar gizli.",
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
    wrongGuessCount: (count) => `Yanlış tahminler: **${count}**.`,
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
  province: {
    label: "🇹🇷 **İl oyunu**",
    gameStarted: (userId, { coverageSource }) =>
      [
        `<@${userId}> yeni bir il oyunu başlattı. İli tahmin etmek için il adını veya plaka kodunu yazın (örneğin \`Ankara\` veya \`06\`).`,
        coverageSource === "google"
          ? "**Kapsama:** Resmi Google Street View"
          : coverageSource === "third-party"
            ? "**Kapsama:** Üçüncü taraf / photosphere. Resmi görüntü değil."
            : "**Kapsama:** Bilinmiyor (bağlantıdan anlaşılamadı)",
      ].join("\n"),
    outsideTurkey: (userId) =>
      `<@${userId}> bu konum Türkiye'de değil. İl oyunu için konum Türkiye'nin 81 ilinden birinde olmalı.`,
    unknownProvince: (userId) =>
      `<@${userId}> bu konumun hangi ilde olduğunu bulamadım. Lütfen başka bir konum seç.`,
    foundProvince: (userId, provinceName) => `<@${userId}> ili buldu: **${provinceName}**.`,
    locationDetails: ({
      district,
      municipality,
      metropolitanMunicipality,
      neighbourhood,
      googleMapsUrl,
      latitude,
      longitude,
    }) =>
      [
        municipality
          ? `Belediye: **${municipality}**${district === "Merkez" ? " (Merkez ilçe)" : ""}`
          : undefined,
        metropolitanMunicipality ? `Büyükşehir: **${metropolitanMunicipality}**` : undefined,
        neighbourhood ? `Mahalle/Köy: **${neighbourhood}**` : undefined,
        `Koordinatlar: **${latitude.toFixed(5)}, ${longitude.toFixed(5)}**`,
        `Link: ${googleMapsUrl}`,
      ]
        .filter(Boolean)
        .join("\n"),
    chooseModePrompt: "Bu konum Türkiye'de. Hangi oyunu başlatmak istiyorsun?",
    chooseCountryButton: "Ülke Oyunu Başlat 🌍",
    chooseProvinceButton: "İl Oyunu Başlat 🇹🇷",
    chooseModeChosen: (mode) =>
      mode === "province" ? "**İl oyunu** başlatılıyor 🇹🇷." : "**Ülke oyunu** başlatılıyor 🌍.",
    chooseModeExpired: "Bu seçimin süresi doldu. Google Haritalar bağlantısını tekrar gönder.",
    chooseModeScreenshotSaved: "Ekran görüntüsü alındı. Yukarıdaki butonlardan oyun türünü seç.",
    startMovedToProvince: (userId) =>
      `<@${userId}> bunun yerine il oyunu başlattı. Burada yeni bir oyun başlatılabilir.`,
    channelNotConfigured: "İl oyunu kanalı yapılandırılmamış.",
    channelUnavailable: "Yapılandırılmış il oyunu kanalına ulaşılamıyor.",
    stats: ({
      completedGames,
      totalGuesses,
      totalPlayers,
      distinctProvinces,
      topProvinceName,
      topProvinceGames,
      medianSolveSeconds,
      oneshotGames,
      hosts,
      participations,
    }) =>
      [
        "🇹🇷 **İl oyunu**",
        `Tamamlanan oyun: **${completedGames}**`,
        `Toplam tahmin: **${totalGuesses}**`,
        `Toplam oyuncu: **${totalPlayers}**`,
        `Oyun başına tahmin: **${formatPerGame(totalGuesses, completedGames, "tr")}**`,
        `Farklı il: **${distinctProvinces}** / 81`,
        topProvinceName == null
          ? "En çok çıkan il: **—**"
          : `En çok çıkan il: **${topProvinceName}** (${topProvinceGames})`,
        `Ortanca süre: **${formatMedianDuration(medianSolveSeconds, "tr")}**`,
        `Tek tahminde biten: **${oneshotGames}**`,
        `Oyun kurucu: **${hosts}**`,
        `Oyun başına oyuncu: **${formatPerGame(participations, completedGames, "tr")}**`,
      ].join("\n"),
    helpCommands: [
      "**İl oyunu** — il adı veya plaka koduyla tahmin et.",
      "`!map` / `!tr` — yanlış tahmin edilen illerin Türkiye haritası",
      "`!ss` — oyunun ekran görüntüsünü tekrar gönder",
      ...trPlayerHelp,
      "Diğer kanallarda veya DM'de il oyunu için `il` ekle (örneğin `!profil il`).",
    ].join("\n"),
    startsState: (enabled) =>
      enabled ? "Yeni il oyunu başlatma **açık**." : "Yeni il oyunu başlatma **kapalı**.",
    startsClosed: (userId) => `<@${userId}> yeni il oyunu başlatma kapalı.`,
  },
} satisfies BotMessages;
