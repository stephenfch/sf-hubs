// =============================================================================
// TRAVEL DATA — window.TRAVEL_DATA
// 用 .js 而唔係 .json 嘅原因：俾老大可以直接 file:// 雙撃開 index.html，
// 唔會被瀏覽器 block 本地 fetch（CORS / origin=null）。
// 改行程只需 edit 呢個 file，唔使 rebuild，push 去 main 即 deploy。
// =============================================================================
window.TRAVEL_DATA = {
  meta: {
    version: "1.0.0",
    updated: "2026-07-15",
    note: "種子數據 = Osaka 2026 鳥取 9日8夜自駕遊（來源：TravelExpert 行程分析 T-3）",
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
            { time: "15:10", icon: "🛬", title: "到達 KIX 關西機場", desc: "入境 + 領行李，最快 16:00 出閘", url: "" },
            { time: "18:00", icon: "🍽️", title: "神戶牛 Dinner", desc: "落機後直去食神戶牛", url: "" },
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
            { time: "", icon: "🌳", title: "Sasagaoka Park 笹ヶ丘公園", desc: "小朋友放電公園", url: "https://maps.app.goo.gl/Gmcb4U6UByx3fKcJ8" },
            { time: "", icon: "🍰", title: "Tea / Dessert", desc: "下午茶時間", url: "" },
            { time: "", icon: "🌻", title: "向日葵（2選1，may skip）", desc: "① 天空のひまわり畑 ② 南光漆野本村（⚠️ 19/7 未開花，建議改東徳久 7/18-7/25）", url: "https://maps.app.goo.gl/LxDkKXbH4QP1JnkH8", tbc: true },
            { time: "", icon: "🛒", title: "Daiso / 超市", desc: "補給日用品", url: "https://maps.app.goo.gl/H73NKakvsUVfdpZB9" },
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
            { time: "", icon: "🧒", title: "鳥取沙丘兒童之國", desc: "アイエム電子鳥取砂丘こどもの国", url: "https://kodomonokuni.tottori.jp/" },
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
            { time: "", icon: "🏜️", title: "鳥取沙丘", desc: "砂丘活動（ Camel / 滑沙 / 散步）", url: "https://www.sakyu-vc.com/jp/activity/" },
            { time: "", icon: "🎨", title: "砂の美術館（加推）", desc: "砂丘旁室內冷氣，35°C 酷暑最佳中途站", url: "" },
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
            { time: "", icon: "🛑", title: "中途休息站：西松屋 / 超市", desc: "", url: "" },
            { time: "09:00", icon: "🌸", title: "鳥取花回廊 とっとり花回廊", desc: "9:00–17:00，星期二休息 → 週三 OK", url: "https://maps.app.goo.gl/baQ8LfdeNz2DBpJA8" },
            { time: "", icon: "🍽️", title: "Dinner @", desc: "未定", url: "", tbc: true },
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
            { time: "11:00", icon: "🌿", title: "Agri-garden 真庭あぐりガーデン", desc: "11:00–14:00 · 公園+動物 · 10-18 營業，週三休", url: "https://maps.app.goo.gl/MbLUfyzQZLkoDC9p9" },
            { time: "15:00", icon: "🍑", title: "岡山摘水果", desc: "吉井農園 / TOMOMIEN 桃茂実苑 / 美作農園（桃放題，需預約）", url: "" },
            { time: "", icon: "🛑", title: "中途休息站：Seria / 超市", desc: "", url: "" },
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
            { time: "", icon: "🅰️", title: "選項 A：姬路中央公園 姫路セントラルパーク", desc: "可揸自己車入園睇動物（Biante MPV OK；開篷/車斗車唔入得）", url: "" },
            { time: "", icon: "🅱️", title: "選項 B：Cycle Monorail サイクルモノレール", desc: "吹田/北大阪", url: "https://maps.app.goo.gl/UMtjBTqck7JcHsY99" },
            { time: "", icon: "🅲️", title: "選項 C：向日葵公園", desc: "需 23/7 住岡山先可以咁排", url: "https://maps.app.goo.gl/2wizmnHLECd81YsH8", tbc: true },
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
            { time: "", icon: "🎡", title: "大阪府立大型児童館ビッグバン", desc: "親子室內遊樂", url: "https://maps.app.goo.gl/Quh1nbtdTJG6s6xx6" },
            { time: "13:00", icon: "🎐", title: "天神祭 本宮", desc: "約 130 萬人！13:00-23:00 會場周邊交通管制 → 搭車入，唔揸車入", url: "" },
            { time: "19:30", icon: "🎆", title: "天神祭花火", desc: "19:30-21:00 · 帶細路去毛馬桜之宮公園北側避人逼", url: "" },
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
            { time: "", icon: "🌳", title: "Eiraku Yumenomori Park 永旺夢美園公園", desc: "近機場輕鬆活動", url: "https://maps.app.goo.gl/4ZRT2DJKN7nw1XiUA" },
            { time: "", icon: "🚗", title: "還車 + To Airport", desc: "16:00 還車", url: "" },
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
        { title: "水木しげるロード（境港）", desc: "妖怪銅像 177 座，細路鍾意", url: "" },
        { title: "わらべ館", desc: "鳥取市內室內玩具館，落雨/酷暑 backup", url: "" },
        { title: "姬路城", desc: "住姬路兩晚但冇 plan 入城，抽 1-2hr 外圍都好", url: "" },
        { title: "鶉野飛行場跡地（加西市）", desc: "26/7 備選，近 KIX", url: "https://www.city.kasai.hyogo.jp/life/3/" },
        { title: "兵庫県立国見の森公園（加東市）", desc: "26/7 備選", url: "https://www.kuniminomori.jp/sp/" },
      ],
    },
  ],
};
