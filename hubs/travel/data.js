// =============================================================================
// TRAVEL DATA — window.TRAVEL_DATA
// 用 .js 而唔係 .json 嘅原因：俾老大可以直接 file:// 雙撃開 index.html，
// 唔會被瀏覽器 block 本地 fetch（CORS / origin=null）。
// 改行程只需 edit 呢個 file，唔使 rebuild。部署：push 去 main 分支（Cloudflare Pages 讀 main）即 redeploy。
//
// 想加相 / 加日誌？睇最底嘅「HOW TO UPDATE」註解。
// =============================================================================
window.TRAVEL_DATA = {
  meta: {
    version: "2.1.0",
    updated: "2026-07-15",
    note: "Osaka 2026 關西/鳥取自駕遊 9日8夜 · 已補齊景點收費/電話/預約 deadline/泊車（來源：Osaka2026_itinerary.md）",
  },

  trips: [
    {
      id: "osaka-2026",
      title: "Osaka 2026 關西自駕遊",
      region: "日本・關西 / 中國地區",
      emoji: "🚗",
      gradient: "from-indigo-500 via-purple-500 to-sky-500",
      accentText: "text-sky-300",
      startDate: "2026-07-18",
      endDate: "2026-07-26",
      status: "upcoming", // upcoming | ongoing | past
      party: "6大4小（共 10 人）",
      transport: "全程自駕 · Mazda Biante 8座 MPV",
      summary:
        "姬路 → 鳥取（3晚）→ 真庭 → 岡山摘桃 → 姬路 → 大阪天神祭，9日8夜親子自駕。",

      // =====================================================================
      // 旅行日誌（📔 獨立 tab）：去到現場影相 + 寫 caption，加落呢個陣列
      // 格式：{ day, time, spot, caption, photo }
      //   photo = 外部圖床 URL（Google Photos / Imgur / GitHub issue 附件）
      // 加完 push 去 master → 線上自動更新
      // =====================================================================
      journal: [
        // 示範（出發前可留空 / 刪走）：
        // { day: 1, time: "18:00", spot: "神戶牛", caption: "落機第一餐！值得", photo: "https://.../kobe.jpg" },
      ],

      flights: [
        {
          date: "2026-07-18",
          flight: "CX506",
          from: "HKG",
          to: "KIX",
          depart: "10:25",
          arrive: "15:10",
          note: "去程 · 波音 777-300 · 經濟艙",
        },
        {
          date: "2026-07-26",
          flight: "CX595",
          from: "KIX",
          to: "HKG",
          depart: "18:30",
          arrive: "21:40",
          note: "回程 · 波音 777-300 · 經濟艙",
        },
      ],

      days: [
        {
          day: 1,
          date: "2026-07-18",
          weekday: "六",
          title: "抵達關西 + 神戶牛",
          location: "姬路",
          hotel: "姬路大和 ROYNET 酒店",
          items: [
            { time: "10:25", icon: "✈️", title: "CX506 起飛", desc: "HKG T1 07:00 check-in", url: "" },
            { time: "15:10", icon: "🛬", title: "到達 KIX 關西機場", desc: "入境 + 領行李，最快 16:00 出閘", url: "https://www.kansai-airport.or.jp/" },
            { time: "18:00", icon: "🍽️", title: "神戶牛 雅 三北店 (Kobe Gyu Miyabi)", desc: "落機後直去食神戶牛 · 建議先行訂位", url: "https://www.koubegyuu.com/miyabi-sankita",
              info: { hours: "午11:30–15:00(L.O.) / 晚17:00–23:00", mapcode: "", intro: "神戶牛 雅 三北店 (Kobe Gyu Miyabi Sankita) · 落機第一餐獎勵 📍兵庫県神戸市中央区北長狹通1-2-7 プラチナビル1–3F（三宮站徒步1分） 💴 午餐A餐(赤身)¥2,750起；晚餐course更貴 📞 建議訂位 078-331-5029（尤其晚餐三宮站旁好旺） 🅿️ 餐廳無専用場，泊三宮站周邊收費停車場 · 由KIX自駕約1.5hr", photoSpot: "燒肉/鐵板燒上枱影特寫", photos: [] } },
            { time: "", icon: "🏨", title: "住：姬路大和 ROYNET 酒店", desc: "Himeji Daiwa Roynet Hotel", url: "" },
          ],
        },
        {
          day: 2,
          date: "2026-07-19",
          weekday: "日",
          title: "公園 + 甜品 + 向日葵 + Daiso",
          location: "姬路 → 鳥取",
          hotel: "鳥取 Green Rich Hotel Tottori Ekimae",
          items: [
            { time: "", icon: "🌳", title: "Sasagaoka Park 笹ヶ丘公園", desc: "小朋友放電公園（100m 滑梯 + 室內運動場）", url: "https://maps.app.goo.gl/Gmcb4U6UByx3fKcJ8",
              info: { hours: "7:00–22:00", mapcode: "", intro: "佐用町嘅綜合公園，全長 100m 滑梯 + 笹ヶ丘ドーム室內運動場，細路放電好去處", photoSpot: "100m 滑梯影小朋友衝落去", photos: [] } },
            { time: "", icon: "🍰", title: "Tea / Dessert", desc: "下午茶時間", url: "",
              info: { hours: "", mapcode: "", intro: "途中搵間 cafe 歎下午茶", photoSpot: "", photos: [] } },
            { time: "", icon: "🌻", title: "向日葵（2選1，may skip）", desc: "① 天空のひまわり畑 ② 南光漆野本村（⚠️ 19/7 未開花，建議改東徳久 7/18-7/25）", url: "https://maps.app.goo.gl/LxDkKXbH4QP1JnkH8", tbc: true,
              info: { hours: "8:30–17:00（東徳久）", mapcode: "", intro: "佐用町南光ひまわり畑，7-8 月向日葵季。東徳久地區 7/18-7/25 最穩陣", photoSpot: "企入花海影打卡相", photos: [] } },
            { time: "", icon: "🛒", title: "Daiso / 超市", desc: "補給日用品", url: "https://maps.app.goo.gl/H73NKakvsUVfdpZB9",
              info: { hours: "10:00–20:00", mapcode: "", intro: "Tenmaya Happies Koge（鳥取八頭町），補給尿片/濕紙巾/零食", photoSpot: "", photos: [] } },
            { time: "", icon: "🏨", title: "住：鳥取 Green Rich Hotel", desc: "グリーンリッチホテル鳥取駅前", url: "" },
          ],
        },
        {
          day: 3,
          date: "2026-07-20",
          weekday: "一",
          title: "鳥取沙丘兒童之國",
          location: "鳥取",
          hotel: "鳥取 Green Rich Hotel Tottori Ekimae",
          items: [
            { time: "", icon: "🧒", title: "鳥取沙丘兒童之國", desc: "アイエム電子鳥取砂丘こどもの国", url: "https://kodomonokuni.tottori.jp/",
              info: { hours: "9:00–17:00（入園 16:30 止）· 第2水曜休", mapcode: "125 702 668", intro: "免費入場嘅大型兒童王國，動物區 + 遊樂設施 + 展望台，10 人家庭好去處", photoSpot: "動物區影羊駝 / 展望台影鳥取市", photos: [] } },
            { time: "", icon: "🏨", title: "住：鳥取 Green Rich Hotel", desc: "", url: "" },
          ],
        },
        {
          day: 4,
          date: "2026-07-21",
          weekday: "二",
          title: "鳥取沙丘",
          location: "鳥取",
          hotel: "鳥取 Green Rich Hotel Tottori Ekimae",
          items: [
            { time: "", icon: "🏜️", title: "鳥取沙丘", desc: "砂丘活動（ Camel / 滑沙 / 散步）", url: "https://www.sakyu-vc.com/jp/activity/",
              info: { hours: "24h（砂丘自由進入）", mapcode: "125 733 831*70", intro: "日本最大砂丘，騎駱駝 / 滑沙 / 日落超靚。35°C 酷暑記得帶水 + 防曬", photoSpot: "日落時影沙丘輪廓 + 駱駝剪影", photos: [] } },
            { time: "", icon: "🎨", title: "砂の美術館（加推）", desc: "砂丘旁室內冷氣，35°C 酷暑最佳中途站", url: "https://www.sakyu-vc.com/jp/sandmuseum/",
              info: { hours: "9:00–18:00（最終入館 17:30）", mapcode: "125 733 357*74", intro: "世界唯一砂像美術館，2026 主題「砂で世界旅行・スペイン／ガウディ」。冷氣室內，酷暑中途站首選", photoSpot: "砂像特寫 + 館外沙丘背景", photos: [] } },
            { time: "", icon: "🏨", title: "住：鳥取 Green Rich Hotel", desc: "", url: "" },
          ],
        },
        {
          day: 5,
          date: "2026-07-22",
          weekday: "三",
          title: "鳥取花回廊",
          location: "鳥取",
          hotel: "鳥取大山美居溫泉度假酒店",
          items: [
            { time: "", icon: "🛑", title: "中途休息站：西松屋 / 超市", desc: "", url: "",
              info: { hours: "", mapcode: "", intro: "出發去花回廊前補給", photoSpot: "", photos: [] } },
            { time: "09:00", icon: "🌸", title: "鳥取花回廊 とっとり花回廊", desc: "9:00–17:00，星期二休息 → 週三 OK", url: "https://maps.app.goo.gl/baQ8LfdeNz2DBpJA8",
              info: { hours: "9:00–17:00（週二休）", mapcode: "252 335 299*37", intro: "日本最大級花卉公園，巨大溫室 + 季節花海 + 噴泉秀。室內外皆有，落雨/酷暑都啱", photoSpot: "噴泉廣場 + 溫室大樹影全家福", photos: [] } },
            { time: "", icon: "🍽️", title: "Dinner @", desc: "未定", url: "", tbc: true,
              info: { hours: "", mapcode: "", intro: "大山美居酒店晚餐或附近食", photoSpot: "", photos: [] } },
            { time: "", icon: "🏨", title: "住：鳥取大山美居溫泉度假酒店", desc: "溫泉親子友善", url: "" },
          ],
        },
        {
          day: 6,
          date: "2026-07-23",
          weekday: "四",
          title: "真庭 → 岡山摘桃",
          location: "真庭 → 岡山 → 姬路",
          hotel: "姬路大和 ROYNET 酒店",
          items: [
            { time: "09:00", icon: "🍳", title: "Hotel breakfast（最遲 9am）", desc: "10:00 leave hotel", url: "" },
            { time: "11:00", icon: "🌿", title: "Agri-garden 真庭あぐりガーデン", desc: "11:00–14:00 · 公園+動物 · 10-18 營業，週三休", url: "https://maps.app.goo.gl/MbLUfyzQZLkoDC9p9",
              info: { hours: "10:00–19:00", mapcode: "235 795 677*12", intro: "真庭市綜合農園/公園，動物區 +  BBQ + 溫泉，週三休。自駕中途好停靠", photoSpot: "動物區影細路餵動物", photos: [] } },
            { time: "15:00", icon: "🍑", title: "岡山摘水果", desc: "吉井農園 / TOMOMIEN 桃茂実苑 / 美作農園（桃放題，需預約）", url: "https://www.tomomien-okayama.com/",
              info: { hours: "受付 9:00–11:00 / 13:00–16:00", mapcode: "", intro: "岡山白桃名物，夏季桃狩り放題。TOMOMIEN 要網上/電話預約，農地冇 navi 搜唔到，跟官網 Google Map", photoSpot: "拎住桃影得意相", photos: [] } },
            { time: "", icon: "🛑", title: "中途休息站：Seria / 超市", desc: "", url: "",
              info: { hours: "", mapcode: "", intro: "100 円店 Seria 補給小物", photoSpot: "", photos: [] } },
            { time: "", icon: "🏨", title: "住：姬路大和 ROYNET 酒店", desc: "⚠️ 同日晚活動在岡山/真庭，夜晚住姬路定岡山待定（影響 24/7 摘桃）", url: "", tbc: true },
          ],
        },
        {
          day: 7,
          date: "2026-07-24",
          weekday: "五",
          title: "彈性日（A / B / C 三選一）",
          location: "姬路 / 岡山 → 大阪",
          hotel: "大阪",
          items: [
            { time: "", icon: "🅰️", title: "選項 A：姬路中央公園 姫路セントラルパーク", desc: "可揸自己車入園睇動物（Biante MPV OK；開篷/車斗車唔入得）", url: "https://www.central-park.co.jp/",
              info: { hours: "9:30–17:00（季節變動）", mapcode: "24 436 128*13", intro: "西日本最大級 Safari + 遊園地，揸自己車入 Safari 區睇動物，Biante MPV 入得", photoSpot: "車入 Safari 影長頸鹿探頭", photos: [] } },
            { time: "", icon: "🅱️", title: "選項 B：Cycle Monorail サイクルモノレール", desc: "吹田/北大阪", url: "https://maps.app.goo.gl/UMtjBTqck7JcHsY99",
              info: { hours: "營業時間随季節", mapcode: "", intro: "生駒山上遊園地嘅空中自轉單軌，踩單車 360° 睇大阪平野絕景", photoSpot: "車廂內影大阪全景", photos: [] } },
            { time: "", icon: "🅲️", title: "選項 C：向日葵公園", desc: "需 23/7 住岡山先可以咁排", url: "https://maps.app.goo.gl/2wizmnHLECd81YsH8", tbc: true,
              info: { hours: "", mapcode: "", intro: "岡山向日葵公園（ひまわりの丘公園等），7-8 月花季", photoSpot: "花海打卡", photos: [] } },
            { time: "", icon: "🏨", title: "住：大阪", desc: "", url: "" },
          ],
        },
        {
          day: 8,
          date: "2026-07-25",
          weekday: "六",
          title: "大阪 + 天神祭（本宮）",
          location: "大阪",
          hotel: "大阪",
          items: [
            { time: "", icon: "🎡", title: "大阪府立大型児童館ビッグバン", desc: "親子室內遊樂", url: "https://maps.app.goo.gl/Quh1nbtdTJG6s6xx6",
              info: { hours: "10:00–17:00（入館 16:30 止）· 月休", mapcode: "10 556 899*37", intro: "堺市嘅未來型兒童館，時光隧道 + 巨大遊具，落雨/酷暑室內放電首選 💴 大人¥1,000 / 中學¥800 / 小學¥800 / 3歲↑幼兒¥600 / 3歲未満免費 🅿️ 3hr¥700→每hr¥300（平日上限¥1,000）；休館日不可用 🗓️ 月曜休（假→翌火）但夏休月曜開館", photoSpot: "室內遊具影細路玩到癲", photos: [] } },
            { time: "13:00", icon: "🎐", title: "天神祭 本宮", desc: "約 130 萬人！13:00-23:00 會場周邊交通管制 → 搭車入，唔揸車入", url: "https://www.tenjinmatsuri.com/",
              info: { hours: "13:00–23:00（本宮）", mapcode: "", intro: "日本三大祭之一，大阪天滿宮 🗓️ 本宮13:30→陸渡御15:30→船渡御18:00→奉納花火19:30–20:50 📍會場大阪天満宮（南森町站/大阪天満宮站）；大川兩岸(桜之宮公園/川崎公園)最佳，櫻宮神社係相對冇咁迫嘅穴場 🌧️ 雨天決行（颱風/大雨警報先中止） ⚠️ 25/7全大阪最癲 → 建議朝早玩完Big Bang就返酒店泊車，搭電車去天満宮，千萬唔好揸車入祭典區", photoSpot: "河岸影船渡御 + 夜祭燈火", photos: [] } },
            { time: "19:30", icon: "🎆", title: "天神祭花火", desc: "19:30-21:00 · 帶細路去毛馬桜之宮公園北側避人逼", url: "https://maps.app.goo.gl/xxxxTenjin",
              info: { hours: "19:30–21:00", mapcode: "", intro: "天神祭花火大會，毛馬桜之宮公園北側相對冇咁逼，帶細路睇得舒服啲", photoSpot: "河邊影花火倒影", photos: [] } },
            { time: "", icon: "🏨", title: "住：大阪（梅田/北區）", desc: "用 akippa 預約高 2.0m 以上平面位泊 Biante", url: "" },
          ],
        },
        {
          day: 9,
          date: "2026-07-26",
          weekday: "日",
          title: "返港",
          location: "大阪 → KIX → HKG",
          hotel: "✈️ 返港",
          items: [
            { time: "", icon: "🌳", title: "Eiraku Yumenomori Park 永旺夢美園公園", desc: "近機場輕鬆活動", url: "https://maps.app.goo.gl/4ZRT2DJKN7nw1XiUA",
              info: { hours: "晝夜開放（公園）", mapcode: "", intro: "關西機場附近 Aeon 夢美園公園，還車前輕鬆放電，細路跑跑", photoSpot: "公園大草地全家福", photos: [] } },
            { time: "", icon: "🚗", title: "還車 + To Airport", desc: "16:00 還車", url: "",
              info: { hours: "", mapcode: "", intro: "16:00 前還 Biante，搭穿梭去 T1", photoSpot: "", photos: [] } },
            { time: "18:30", icon: "✈️", title: "CX595 起飛 KIX → HKG", desc: "21:40 到香港", url: "" },
          ],
        },
      ],

      // 風險 / 注意事項（level: red | orange | yellow）
      risks: [
        { level: "red", icon: "⛔", title: "租車超載：8座車 vs 10人", desc: "6-8歲細仔要獨立學童安全帶，8座最多載8人（包司機）。超載違法 + 保險失效 → 改租 10座 或朋友家庭各自租車。" },
        { level: "red", icon: "⛔", title: "取車時間/地點太趕", desc: "15:10 到 KIX，出閘最快 16:00，原定 16:00 @ 大阪市區根本趕唔切 → 改 KIX 空港取車。" },
        { level: "orange", icon: "⚠️", title: "MPV 車高 vs 大阪泊車場", desc: "Biante 車高約 1.85m，大阪機械式泊車場限高 155-175cm 入唔到 → 揀平面位/ハイルーフ對應，或用 akippa 預約。" },
        { level: "orange", icon: "🎆", title: "天神祭管制 + 泊車", desc: "7/25 本宮約 130 萬人，13:00-23:00 通行禁止 → 泊梅田/北區，搭地鐵入會場。" },
        { level: "orange", icon: "🌡️", title: "7月酷暑 35°C+", desc: "室內 backup（砂の美術館、わらべ館）、補水、早出晚歸。" },
        { level: "orange", icon: "🌊", title: "南海海槽地震", desc: "30年內 7-8 級 70-80% → 帶地震應急包、記避難路線。" },
        { level: "yellow", icon: "🐻", title: "兵庫熊出沒（宍粟/小野 7月）", desc: "山區拍高聲、唔近叢林。" },
      ],

      // 待決事項 (TBC)
      tbc: [
        "19/7 向日葵開花 timing（漆野本村 19/7 未開 → 改東徳久 or skip）",
        "23/7 夜晚住邊：姬路 OR 岡山？（影響 24/7 摘桃）",
        "24/7 選邊個：A 姫路中央公園 / B Cycle Monorail / C 向日葵公園",
        "22/7 Dinner @ 未定",
        "關西單車體育中心「24/12 close」需 confirm 7月開放",
      ],

      // 加推景點 / 備選
      extras: [
        { title: "砂の美術館", desc: "砂丘旁室內冷氣（已加落 Day 4）", url: "" },
        { title: "水木しげるロード（境港）", desc: "妖怪銅像 177 座，細路鍾意", url: "https://maps.app.goo.gl/mizuki",
          info: { hours: "商店 9:30–18:00", mapcode: "109 762 136*35", intro: "鬼太郎作者故鄉，妖怪青銅像 177 座 + 妖怪茶屋，細路興奮到癲", photoSpot: "同妖怪銅像打卡", photos: [] } },
        { title: "わらべ館", desc: "鳥取市內室內玩具館，落雨/酷暑 backup", url: "https://warabe.or.jp/",
          info: { hours: "9:00–17:00（入館 16:30 止）· 第3水曜休", mapcode: "125 613 130*05", intro: "鳥取童謠・玩具館，室內玩具 + 體感遊具，落雨/酷暑 backup 首選", photoSpot: "玩具牆影細路", photos: [] } },
        { title: "姬路城", desc: "住姬路兩晚但冇 plan 入城，抽 1-2hr 外圍都好", url: "https://www.himejicastle.jp/",
          info: { hours: "9:00–17:00（入城 16:00 止）", mapcode: "24 308 317*17", intro: "日本第一名城，白漆天守閣。住姬路兩晚，抽 1-2hr 入城或外圍影相都值得", photoSpot: "天守閣正面 + 櫻/蓮池", photos: [] } },
        { title: "鶉野飛行場跡地（加西市）", desc: "26/7 備選，近 KIX", url: "https://www.city.kasai.hyogo.jp/life/3/",
          info: { hours: "晝夜開放（公園）", mapcode: "", intro: "舊陸軍飛行場跡，噴水池 + 滑梯 + 歷史展示，返機場前輕鬆停", photoSpot: "噴水池影細路", photos: [] } },
        { title: "兵庫県立国見の森公園（加東市）", desc: "26/7 備選", url: "https://www.kuniminomori.jp/sp/",
          info: { hours: "9:00–17:00（月休）", mapcode: "114 828 841*64", intro: "里山森林公園，BBQ + 蹴球場 + 自然體驗，返機場前大自然放電", photoSpot: "森林木屑路影全家", photos: [] } },
      ],
    },
  ],
};

/* ===========================================================================
 * HOW TO UPDATE（去旅行時加相 / 加日誌）— 全部喺 GitHub 網頁改完 push 就得
 * ---------------------------------------------------------------------------
 * 1) 加景點相（A 模式：貼 URL 再 push）
 *    喺對應 item 嘅 info.photos 陣列加 URL：
 *      info: { ..., photos: ["https://photos.app.goo.gl/xxxx", "https://i.imgur.com/yyyy.jpg"] }
 *    → 網站「📸 加相」button 會彈出貼 URL 嘅指引 + 自動生成呢段 code。
 *
 * 2) 加旅行日誌（📔 獨立 tab）
 *    喺 trip.journal 陣列加一筆：
 *      { day: 2, time: "15:00", spot: "鳥取沙丘", caption: "滑沙超好玩！", photo: "https://..." }
 *    → 會按 Day/時間 排時間線 show 相 + caption。
 *
 * 相 URL 來源（Q1=B 外部圖床，repo 唔存相，只存 URL）：
 *   - Google Photos 分享連結（maps.app.goo.gl / photos.app.goo.gl）
 *   - Imgur / postimages 等圖床
 *   - 或者 GitHub issue 附件 → 複製 raw 圖片 URL
 * 唔好直接 commit 相片落 repo（會變大，違反輕量原則）。
 * =========================================================================== */
