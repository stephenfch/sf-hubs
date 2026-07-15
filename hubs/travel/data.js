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
    version: "2.2.0",
    updated: "2026-07-15",
    note: "Osaka 2026 關西/鳥取自駕遊 9日8夜 · v2.2.0：加 Times CAR RENTAL 第二部車（Mazda Biante + Honda Step WGN），更新風險狀態",
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
      party: "4大3小（共 7 人）",
      transport: "全程自駕 · 🚙 ① Honda Step WGN + 🚙 ② Mazda Biante 8座 MPV（Times CAR RENTAL × 2）",
      summary:
        "姬路 → 鳥取（3晚）→ 真庭 → 岡山摘桃 → 姬路 → 大阪天神祭，9日8夜親子自駕。",
      myMapsEmbed: "https://www.google.com/maps/d/u/0/embed?mid=1LuuiiWAbTEBuR2loYXmtRSgLz-vNYZE&ehbc=2E312F",
      myMapsViewer: "https://www.google.com/maps/d/u/0/viewer?mid=1LuuiiWAbTEBuR2loYXmtRSgLz-vNYZE",

      // 天氣查詢用經緯度 mapping（自動 match location → Open-Meteo API）
      weatherCoords: {
        "姬路":    { lat: 34.8167, lon: 134.6833 },
        "鳥取":    { lat: 35.5039, lon: 134.2378 },
        "真庭":    { lat: 35.0833, lon: 133.7500 },
        "岡山":    { lat: 34.6618, lon: 133.9350 },
        "大阪":    { lat: 34.6937, lon: 135.5023 },
        "關西機場":{ lat: 34.4320, lon: 135.2304 },
        "KIX":     { lat: 34.4320, lon: 135.2304 },
        "吹田":    { lat: 34.7667, lon: 135.5167 },
        "堺":      { lat: 34.5833, lon: 135.4667 },
      },

      // 點對點車程估算（自駕，Google Maps 估算，用於地圖總覽）
      cityDrives: {
        "KIX→姬路": "1.5hr",
        "KIX→神戶": "1hr",
        "神戶→姬路": "1hr",
        "姬路→鳥取": "2hr",
        "鳥取→真庭": "1.5hr",
        "鳥取→岡山": "2hr",
        "鳥取→大山": "30min",
        "大山→真庭": "1hr",
        "真庭→岡山": "45min",
        "岡山→姬路": "1.5hr",
        "姬路→大阪": "1hr",
        "姬路/岡山→大阪": "1hr",
        "大阪→KIX": "1hr",
        "大阪→堺": "30min",
      },

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
          location: "KIX→姬路",
          hotel: "姬路大和 ROYNET 酒店",
          weather: { icon: "🌦️", high: 32, low: 26, cond: "多雲有驟雨", note: "氣候平均 · 出發前 3 日再確認實際預報" },
          items: [
            { time: "10:25", icon: "✈️", title: "CX506 起飛", desc: "HKG T1 07:00 check-in", url: "" },
            { time: "15:10", icon: "🛬", title: "到達 KIX 關西機場", desc: "入境 + 領行李，最快 16:00 出閘", url: "https://www.kansai-airport.or.jp/", drive: "4.5hr（飛航）" },
            { time: "18:00", icon: "🍽️", title: "神戶牛 雅 三北店 (Kobe Gyu Miyabi)", desc: "落機後直去食神戶牛 · 建議先行訂位", url: "https://www.koubegyuu.com/miyabi-sankita", drive: "1.5hr",
              info: { hours: "午11:30–15:00(L.O.) / 晚17:00–23:00", mapcode: "", intro: "神戶牛 雅 三北店 (Kobe Gyu Miyabi Sankita) · 落機第一餐獎勵 📍兵庫県神戸市中央区北長狹通1-2-7 プラチナビル1–3F（三宮站徒步1分） 💴 午餐A餐(赤身)¥2,750起；晚餐course更貴 📞 建議訂位 078-331-5029（尤其晚餐三宮站旁好旺） 🅿️ 餐廳無専用場，泊三宮站周邊收費停車場 · 由KIX自駕約1.5hr", photoSpot: "燒肉/鐵板燒上枱影特寫", photos: [] } },
            { time: "", icon: "🏨", title: "住：姬路大和 ROYNET 酒店", desc: "Himeji Daiwa Roynet Hotel", url: "", drive: "1hr" },
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
            { time: "", icon: "🍰", title: "Tea / Dessert", desc: "下午茶時間", url: "", drive: "15min",
              info: { hours: "", mapcode: "", intro: "途中搵間 cafe 歎下午茶", photoSpot: "", photos: [] } },
            { time: "", icon: "🌻", title: "向日葵（2選1，may skip）", desc: "① 天空のひまわり畑 ② 南光漆野本村（⚠️ 19/7 未開花，建議改東徳久 7/18-7/25）", url: "https://maps.app.goo.gl/LxDkKXbH4QP1JnkH8", tbc: true, drive: "15min",
              info: { hours: "8:30–17:00（東徳久）", mapcode: "", intro: "佐用町南光ひまわり畑，7-8 月向日葵季。東徳久地區 7/18-7/25 最穩陣", photoSpot: "企入花海影打卡相", photos: [] } },
            { time: "", icon: "🛒", title: "Daiso / 超市", desc: "補給日用品", url: "https://maps.app.goo.gl/H73NKakvsUVfdpZB9", drive: "1hr",
              info: { hours: "10:00–20:00", mapcode: "", intro: "Tenmaya Happies Koge（鳥取八頭町），補給尿片/濕紙巾/零食", photoSpot: "", photos: [] } },
            { time: "", icon: "🏨", title: "住：鳥取 Green Rich Hotel", desc: "グリーンリッチホテル鳥取駅前", url: "", drive: "30min" },
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
            { time: "", icon: "🏨", title: "住：鳥取 Green Rich Hotel", desc: "", url: "", drive: "15min" },
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
            { time: "", icon: "🎨", title: "砂の美術館（加推）", desc: "砂丘旁室內冷氣，35°C 酷暑最佳中途站", url: "https://www.sakyu-vc.com/jp/sandmuseum/", drive: "5min（徒步）",
              info: { hours: "9:00–18:00（最終入館 17:30）", mapcode: "125 733 357*74", intro: "世界唯一砂像美術館，2026 主題「砂で世界旅行・スペイン／ガウディ」。冷氣室內，酷暑中途站首選", photoSpot: "砂像特寫 + 館外沙丘背景", photos: [] } },
            { time: "", icon: "🏨", title: "住：鳥取 Green Rich Hotel", desc: "", url: "", drive: "15min" },
          ],
        },
        {
          day: 5,
          date: "2026-07-22",
          weekday: "三",
          title: "鳥取花回廊",
          location: "鳥取→大山",
          hotel: "鳥取大山美居溫泉度假酒店",
          items: [
            { time: "", icon: "🛑", title: "中途休息站：西松屋 / 超市", desc: "", url: "", drive: "15min（由酒店出發）",
              info: { hours: "", mapcode: "", intro: "出發去花回廊前補給", photoSpot: "", photos: [] } },
            { time: "09:00", icon: "🌸", title: "鳥取花回廊 とっとり花回廊", desc: "9:00–17:00，星期二休息 → 週三 OK", url: "https://maps.app.goo.gl/baQ8LfdeNz2DBpJA8", drive: "30min",
              info: { hours: "9:00–17:00（週二休）", mapcode: "252 335 299*37", intro: "日本最大級花卉公園，巨大溫室 + 季節花海 + 噴泉秀。室內外皆有，落雨/酷暑都啱", photoSpot: "噴泉廣場 + 溫室大樹影全家福", photos: [] } },
            { time: "", icon: "🍽️", title: "Dinner @", desc: "未定", url: "", tbc: true, drive: "20min",
              info: { hours: "", mapcode: "", intro: "大山美居酒店晚餐或附近食", photoSpot: "", photos: [] } },
            { time: "", icon: "🏨", title: "住：鳥取大山美居溫泉度假酒店", desc: "溫泉親子友善", url: "", drive: "15min" },
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
            { time: "11:00", icon: "🌿", title: "Agri-garden 真庭あぐりガーデン", desc: "11:00–14:00 · 公園+動物 · 10-18 營業，週三休", url: "https://maps.app.goo.gl/MbLUfyzQZLkoDC9p9", drive: "1.5hr",
              info: { hours: "10:00–19:00", mapcode: "235 795 677*12", intro: "真庭市綜合農園/公園，動物區 +  BBQ + 溫泉，週三休。自駕中途好停靠", photoSpot: "動物區影細路餵動物", photos: [] } },
            { time: "15:00", icon: "🍑", title: "岡山摘水果", desc: "吉井農園 / TOMOMIEN 桃茂実苑 / 美作農園（桃放題，需預約）", url: "https://www.tomomien-okayama.com/", drive: "45min",
              info: { hours: "受付 9:00–11:00 / 13:00–16:00", mapcode: "", intro: "岡山白桃名物，夏季桃狩り放題。TOMOMIEN 要網上/電話預約，農地冇 navi 搜唔到，跟官網 Google Map", photoSpot: "拎住桃影得意相", photos: [] } },
            { time: "", icon: "🛑", title: "中途休息站：Seria / 超市", desc: "", url: "", drive: "30min",
              info: { hours: "", mapcode: "", intro: "100 円店 Seria 補給小物", photoSpot: "", photos: [] } },
            { time: "", icon: "🏨", title: "住：姬路大和 ROYNET 酒店", desc: "⚠️ 同日晚活動在岡山/真庭，夜晚住姬路定岡山待定（影響 24/7 摘桃）", url: "", tbc: true, drive: "1.5hr" },
          ],
        },
        {
          day: 7,
          date: "2026-07-24",
          weekday: "五",
          title: "彈性日（A / B / C 三選一）",
          location: "姬路/岡山→大阪",
          hotel: "大阪北濱布萊頓酒店",
          items: [
            { time: "", icon: "🅰️", title: "選項 A：姬路中央公園 姫路セントラルパーク", desc: "可揸自己車入園睇動物（Biante MPV OK；開篷/車斗車唔入得）", url: "https://www.central-park.co.jp/",
              info: { hours: "9:30–17:00（季節變動）", mapcode: "24 436 128*13", intro: "西日本最大級 Safari + 遊園地，揸自己車入 Safari 區睇動物，Biante MPV 入得", photoSpot: "車入 Safari 影長頸鹿探頭", photos: [] } },
            { time: "", icon: "🅱️", title: "選項 B：Cycle Monorail サイクルモノレール", desc: "吹田/北大阪", url: "https://maps.app.goo.gl/UMtjBTqck7JcHsY99", drive: "1hr",
              info: { hours: "營業時間随季節", mapcode: "", intro: "生駒山上遊園地嘅空中自轉單軌，踩單車 360° 睇大阪平野絕景", photoSpot: "車廂內影大阪全景", photos: [] } },
            { time: "", icon: "🅲️", title: "選項 C：向日葵公園", desc: "需 23/7 住岡山先可以咁排", url: "https://maps.app.goo.gl/2wizmnHLECd81YsH8", tbc: true, drive: "30min",
              info: { hours: "", mapcode: "", intro: "岡山向日葵公園（ひまわりの丘公園等），7-8 月花季", photoSpot: "花海打卡", photos: [] } },
            { time: "", icon: "🏨", title: "住：大阪北濱布萊頓酒店 (Hotel Brighton City Osaka Kitahama)", desc: "Check-in 15:00 · 🅿️ 北濱站附近平面泊車場（Biante 1.85m 入到）", url: "https://www.trip.com/w/HkHrHLP6XV2", drive: "1hr",
              info: { hours: "Check-in 15:00 / Check-out 11:00", intro: "🏨 大阪北濱布萊頓酒店 ⭐ 9.2/10（Trip.com）📍 北長狭通1丁目1 — 北濱站5號口步行1分鐘 🚇 🏪 樓下7-11 🅿️ Biante(1.85m)要揀平面位／akippa 🛁 有浴缸 🧺 洗衣機+微波爐 🚰 大堂免費瓶裝水 🍳 早餐自助06:30–10:00（成人¥2,200/6歲以下免費/7-12歲¥1,350）" } },
          ],
        },
        {
          day: 8,
          date: "2026-07-25",
          weekday: "六",
          title: "未來兒童館 + 天神祭（全步行日）",
          location: "大阪",
          hotel: "大阪北濱布萊頓酒店",
          items: [
            { time: "", icon: "🧒", title: "キッズプラザ大阪 (Kids Plaza Osaka) 未來兒童館", desc: "室內有冷氣，5層樓兒童博物館，行路到天神祭", url: "https://www.kidsplaza.or.jp",
              info: { hours: "9:30–17:00（最終入館 16:15）", mapcode: "", intro: "大阪市北區扇町嘅兒童博物館 🕐 9:30–17:00 💴 大人¥1,500 / 小中¥800 / 幼兒(3歲↑)¥500 🚇 堺筋線「扇町」站2號出口直達 🅿️ 無専用場 → 酒店泊車搭地鐵 ⭐ 職業體驗/科學實驗/チューブスライダー/文化コーナー 📞 06-6311-6601", photoSpot: "5F 文化コーナー同チューブスライダー", photos: [] } },
            { time: "~14:00", icon: "🎐", title: "天神祭 本宮", desc: "日本三大祭！玩完 Kids Plaza 行過去，唔使搭車", url: "https://www.tenjinmatsuri.com/",
              info: { hours: "13:00–23:00（本宮）", mapcode: "", intro: "日本三大祭之一，大阪天滿宮 🗓️ 本宮13:30→陸渡御15:30→船渡御18:00→奉納花火19:30–20:50 📍會場大阪天満宮（南森町站/大阪天満宮站）🚶 扇町站行5-10分鐘就到，全步行日！ ⚠️ 全日唔揸車，酒店泊車後搭地鐵/行路", photoSpot: "河岸影船渡御 + 夜祭燈火", photos: [] } },
            { time: "19:30", icon: "🎆", title: "天神祭花火", desc: "19:30-21:00 · 帶細路去毛馬桜之宮公園北側避人逼", url: "https://maps.app.goo.gl/xxxxTenjin", drive: "步行約10-15min",
              info: { hours: "19:30–21:00", mapcode: "", intro: "天神祭花火大會，毛馬桜之宮公園北側相對冇咁逼，帶細路睇得舒服啲", photoSpot: "河邊影花火倒影", photos: [] } },
            { time: "", icon: "🏨", title: "住：大阪北濱布萊頓酒店 (Hotel Brighton City Osaka Kitahama)", desc: "Check-in 15:00 · 🅿️ 北濱站附近平面泊車場（Biante 1.85m 入到）", url: "https://www.trip.com/w/HkHrHLP6XV2", drive: "搭車約15min",
              info: { hours: "Check-in 15:00 / Check-out 11:00", intro: "🏨 大阪北濱布萊頓酒店 ⭐ 9.2/10（Trip.com）📍 北長狭通1丁目1 — 北濱站5號口步行1分鐘 🚇 🏪 樓下7-11 🅿️ Biante(1.85m)要揀平面位／akippa 🛁 有浴缸 🧺 洗衣機+微波爐 🚰 大堂免費瓶裝水 🍳 早餐自助06:30–10:00（成人¥2,200/6歲以下免費/7-12歲¥1,350）" } },
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
            { time: "", icon: "🚗", title: "還車 + To Airport", desc: "16:00 還車", url: "", drive: "15min",
              info: { hours: "", mapcode: "", intro: "16:00 前還 Biante，搭穿梭去 T1", photoSpot: "", photos: [] } },
            { time: "18:30", icon: "✈️", title: "CX595 起飛 KIX → HKG", desc: "21:40 到香港", url: "", drive: "搭 shuttle 10min" },
          ],
        },
      ],

      // 風險 / 注意事項（level: red | orange | yellow）
      risks: [
        { level: "green", icon: "✅", title: "租車超載：已解決", desc: "已改：⓵ Honda Step WGN + ⓶ Mazda Biante 8座（Times CAR RENTAL），兩部車共 15 座位，7 人 + 行李冇問題。取車 18/7 16:00 @ KIX，還車 26/7 16:00 @ KIX。" },
        { level: "green", icon: "✅", title: "取車時間：已解決", desc: "航班 15:10 到 KIX，取車單寫 16:00 可取，時間 fit ✅。員工會分兩組：一組去 Times counter 取兩部車，一組睇行李+細路。" },
        { level: "orange", icon: "⚠️", title: "兩部車車高 vs 大阪泊車場", desc: "Biante 約 1.85m、Step WGN 約 1.85m，大阪機械式泊車場限高 155-175cm 入唔到 → 兩部都要揀平面位/ハイルーフ對應，或 akippa 預約。" },
        { level: "orange", icon: "🎆", title: "天神祭管制 + 泊車", desc: "7/25 本宮約 130 萬人，13:00-23:00 通行禁止 → 泊梅田/北區，搭地鐵入會場。" },
        { level: "orange", icon: "🌡️", title: "7月酷暑 35°C+", desc: "室內 backup（砂の美術館、わらべ館）、補水、早出晚歸。" },
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

      // 實用資訊（網站／工具／App）
      practicalInfo: [
        // ─ 自駕篇 ─
        { cat: "🚙 自駕", items: [
          { icon: "🛣️", title: "日本高速公路 ETC", desc: "租車一般已附 ETC 卡。日本高速收費高（KIX→姬路 ~¥4,000），建議用 Google Maps / Yahoo! カーナビ 規劃路線。",
            url: "https://www.driveplaza.com/route_search/", note: "ETC 閘口行左邊「ETC/一般」lane冇問題" },
          { icon: "⛽", title: "油站（給油所）", desc: "日本油站分 セルフ（自助平啲）同 full service。租車通常入滿還車。7月油價 ~¥175/L。",
            url: "https://gogo.gs/", note: "Google Maps 直接搜「ガソリンスタンド」就搵到" },
          { icon: "🅿️", title: "駐車場（泊車）", desc: "大阪機械式停車場限高 155-175cm — Biante(1.85m)/Step WGN(1.85m) 入唔到！要揀平面/ハイルーフ。推薦 akippa 預約。",
            url: "https://akippa.com/", note: "Times / akippa 平面位、コインパーキング 500-800円/hr；天神祭當日要泊梅田再搭地鐵" },
          { icon: "🧭", title: "Mapion（日本地圖）", desc: "日本行車用 Mapion 比 Google Maps 更精確（特別係鄉郊 address），支援 mapcode 搜尋。",
            url: "https://www.mapion.co.jp/", note: "每個景點都有 mapcode — 直接 copy 入 Mapion 即可導航" },
        ]},
        // ─ 飲食篇 ─
        { cat: "🍽️ 飲食", items: [
          { icon: "🍜", title: "Tabelog 食べログ", desc: "日本最大級餐廳搜尋/評分平台，類似 OpenRice。搵餐廳、睇評分、Menu、使費，必裝 App！",
            url: "https://tabelog.com/", note: "支援地圖搜尋、菜式篩選、預算範圍，日文為主但漢字+圖片夠用" },
          { icon: "📞", title: "AutoReserve 訂位", desc: "日本餐廳網上訂位平台，支援多語言，唔使打電話。熱門餐廳建議早幾日 book。",
            url: "https://autoreserve.com/", note: "免費登記，可即時查看空位並確認 booking" },
          { icon: "☕", title: "日本便利店攻略", desc: "7-11 / Lawson / FamilyMart 係自駕恩物！ATM 提款（支援海外卡）、列印、廁所、熱食、咖啡。",
            url: "", note: "7-11 嘅 ATM 支援中文介面；Lawson 嘅炸雞 L（からあげクン）係細路至愛" },
        ]},
        // ─ 網絡篇 ─
        { cat: "📶 網絡", items: [
          { icon: "📱", title: "日本上網 SIM / eSIM", desc: "推薦 Ubigi / Airalo eSIM（15日 10GB ~$5-10 USD），或預先買日本上網 SIM（Bic Camera / Yodobashi）。",
            url: "https://www.ubigi.com/", note: "7人同行建議主要大人買 eSIM share hotspot，細路用 WiFi 蛋" },
          { icon: "📡", title: "免費 Wi-Fi", desc: "7-11 / Starbucks / 麥當勞 / 大型車站 有免費 Wi-Fi。偏遠地區（鳥取大山）可能冇訊號，事前 download 離線 Google Map。",
            url: "", note: "出發前喺 Google Maps download「関西」「鳥取」離線地圖" },
        ]},
        // ─ 文化篇 ─
        { cat: "🗾 旅行常識", items: [
          { icon: "🔌", title: "插頭・電壓", desc: "日本用 A 型 2腳扁插（同美國/台灣一樣），100V / 50-60Hz。香港三腳插要帶轉換頭。手機/相機充電器一般 100-240V 寬電壓。",
            url: "", note: "建議帶一個 4-port USB 充電器 + 2-3 個轉換插" },
          { icon: "💰", title: "貨幣・匯率", desc: "日本主要用現金（尤其鄉郊），但大城市大多支援 IC 卡（Suica/PASMO）同信用卡。7月約 ¥100 ≈ HK$5.2。",
            url: "https://www.xe.com/currencyconverter/convert/?From=JPY&To=HKD", note: "建議帶 ¥30-50 萬現金（自駕/鄉郊/祭典攤位需現金），其餘用信用卡" },
          { icon: "🎌", title: "小費文化", desc: "日本冇小費文化！唔好比 tips。酒店/餐廳/的士都唔使。反而要識講「ありがとうございます」（多謝）。",
            url: "", note: "唯一例外：旅館嘅「仲居さん」（服務員）可以喺信封入 ¥1,000-3,000 表示感謝，但非必要" },
          { icon: "🚻", title: "洗手間文化", desc: "日本公廁好乾淨，但偏遠地區（山區/沙丘）可能冇廁所。車上備垃圾袋 + 濕紙巾。",
            url: "", note: "便利店、大型休息站（道の駅）一定有位，而且間間有免治馬桶" },
        ]},
        // ─ 緊急篇 ─
        { cat: "🆘 緊急", items: [
          { icon: "🚓", title: "緊急電話一覽", desc: "警察 110（事故・盜竊）／消防救護 119（火災・急病）／海上保安庁 118（海上事故）。",
            url: "", note: "119 都有英文/中文支援。講「Help」或「Chinese お願いします」即可" },
          { icon: "🏥", title: "旅遊保險・醫療", desc: "出發前確認旅遊保險 cover COVID / 自駕意外。日本醫療費貴（門診 ~¥10,000-20,000），保險好重要。",
            url: "", note: "AMDA 医療通訳（03-5285-8080）提供免費醫療翻譯" },
          { icon: "🇭🇰", title: "中國駐日使領館", desc: "大阪總領事館：06-6445-9481（緊急求助）。護照遺失 / 重大事故用。",
            url: "https://www.china-consulate.or.jp/", note: "地址：大阪市西区靭本町3-9-2；辦公時間平日 9:00-12:00 / 13:30-16:30" },
          { icon: "🆘", title: "災害用傳言板", desc: "地震/颱風時，NTT 災害用傳言板（web171）可以留言報平安。家人喺香港都可以 Check。",
            url: "https://www.web171.jp/", note: "使用方法：撥 171 → 按 1 → 輸入電話號碼 → 錄音留言" },
        ]},
        // ─ 購物篇 ─
        { cat: "🛍️ 購物", items: [
          { icon: "🏪", title: "ドン・キホーテ（驚安の殿堂）", desc: "24小時綜合折扣店，藥妝 / 電器 / 食品 / 日用品 / 手信一條街搞掂。機場店有免稅。",
            url: "https://www.donki.com/", note: "天神祭附近嘅道頓堀店營業到凌晨，但人超多" },
          { icon: "💊", title: "日本藥妝（マツモトキヨシ / スギ薬局）", desc: "防曬 / 驅蚊 / 止痛藥 / 腸胃藥 / 膠布 — 直接喺日本買平過香港！",
            url: "", note: "松本清（マツモトキヨシ）同 Sugi 藥局遍布各城市，退稅滿 ¥5,000" },
          { icon: "🧧", title: "免稅（Tax Free）", desc: "一般商品 + 消耗品合計 ¥5,000 以上免稅。passport 要隨身，買完店員會釘單入境時海關收。",
            url: "", note: "藥妝食品飲料分類都係消耗品 — 會用透明袋封好，日本境內唔用得" },
        ]},
      ],

      // =====================================================================
      // 🎒 行李清單 — 7月日本關西親子自駕
      // 分類：證件/電子/衣物/洗漱/醫藥/兒童/自駕/其他
      // checked: true = 已經打包
      // =====================================================================
      packing: [
        // ─ 證件類 ─
        { cat: "📄 證件", items: [
          { what: "護照（7 本）", checked: false },
          { what: "電子簽證 / Visit Japan Web QR", checked: false },
          { what: "機票 / 訂位確認", checked: false },
          { what: "Times CAR RENTAL 租車確認單×2", checked: false },
          { what: "酒店訂單（全部 8 晚）", checked: false },
          { what: "國際駕駛許可證 IDP（兩位司機）", checked: false },
          { what: "Travel Insurance 保險單", checked: false },
        ]},
        // ─ 電子類 ─
        { cat: "📱 電子", items: [
          { what: "手機 + 充電線×7", checked: false },
          { what: "日本上網 SIM / eSIM", checked: false },
          { what: "行動電源 ×2", checked: false },
          { what: "車充（USB-C ×2）", checked: false },
          { what: "相機 / GoPro + 記憶卡", checked: false },
          { what: "自拍棍", checked: false },
        ]},
        // ─ 衣物類（7月酷暑）─
        { cat: "👕 衣物（35°C+ 酷暑）", items: [
          { what: "薄衫/短褲 / 連衣裙（每人每日一套）", checked: false },
          { what: "泳衣 / 沙灘褲（酒店溫泉 + 沙丘）", checked: false },
          { what: "輕薄防曬外套 / UV 帽", checked: false },
          { what: "太陽眼鏡", checked: false },
          { what: "運動鞋 / 涼鞋", checked: false },
          { what: "睡衣", checked: false },
          { what: "內衣襪（足夠 9 日）", checked: false },
        ]},
        // ─ 洗漱類 ─
        { cat: "🧴 洗漱", items: [
          { what: "牙刷牙膏（7 套）", checked: false },
          { what: "洗面乳 / 護膚品", checked: false },
          { what: "防曬（超高 SPF，必帶）", checked: false },
          { what: "驅蚊噴霧 / 止痕膏", checked: false },
          { what: "濕紙巾 / 紙巾（大量）", checked: false },
          { what: "口罩（備用）", checked: false },
        ]},
        // ─ 醫藥類 ─
        { cat: "💊 醫藥", items: [
          { what: "退燒藥 / 止痛藥", checked: false },
          { what: "腸胃藥 / 止瀉藥", checked: false },
          { what: "蚊蟲止癢 / 抗敏藥", checked: false },
          { what: "膠布 / 消毒藥水", checked: false },
          { what: "體溫計", checked: false },
          { what: "大人細路各人常用藥", checked: false },
        ]},
        // ─ 兒童類 ─
        { cat: "🧒 兒童（3 個細路）", items: [
          { what: "兒童座椅×3（租車附？要確認）", checked: false },
          { what: "尿片 / 學習褲（夠 9 日）", checked: false },
          { what: "濕紙巾 + 垃圾袋", checked: false },
          { what: "零食 / 餅乾 / 果汁（車上）", checked: false },
          { what: "玩具書 / iPad 落 apps 睇片", checked: false },
          { what: "細路用防曬 + 驅蚊", checked: false },
          { what: "小童水壺", checked: false },
        ]},
        // ─ 自駕類 ─
        { cat: "🚙 自駕", items: [
          { what: "導航手機座×2", checked: false },
          { what: "ETC 卡（租車時確認有）", checked: false },
          { what: "停車地圖 / akippa 預約", checked: false },
          { what: "車用遮陽擋", checked: false },
        ]},
        // ─ 其他 ─
        { cat: "🎒 其他", items: [
          { what: "環保購物袋（超市用）", checked: false },
          { what: "摺疊傘 / 雨衣（7月雨季尾）", checked: false },
          { what: "密封袋（分開濕衫/垃圾）", checked: false },
          { what: "垃圾桶（車用細袋）", checked: false },
          { what: "便攜餐具（細路用）", checked: false },
        ]},
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
