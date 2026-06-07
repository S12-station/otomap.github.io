const GAS_URL = 'https://script.google.com/macros/s/AKfycbz01EQuEGIaqjoyydvJLa-kAC2AzP0bpWr_55G4P418DoWwq7T_QwNCecCuYxlbxAqVSQ/exec';

// 日本の領域を定義 (南西の端:沖縄方面, 北東の端:北海道・千島方面)
const japanBounds = L.latLngBounds([20.0, 122.0], [46.0, 154.0]);

// マップの初期化 (日本国外へのスクロールを制限して軽くする)
const map = L.map('map', { 
  zoomControl: false,
  maxBounds: japanBounds,
  maxBoundsViscosity: 1.0,
  minZoom: 5
}).setView([43.0686, 141.3508], 12);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// CSVをパース
function fetchCsv(path) {
  return new Promise((resolve) => {
    Papa.parse(path, {
      download: true,
      header: true,
      dynamicTyping: true,
      complete: (results) => resolve(results.data)
    });
  });
}

// データのロードとピン打ち
async function loadMapData() {
  try {
    const [madsRes, stationsCsv] = await Promise.all([
      fetch(GAS_URL).then(res => res.json()),
      fetchCsv('csv/station.csv')
    ]);

    // 駅データを辞書化
    const stationDict = new Map();
    stationsCsv.forEach(st => {
      if (st.station_cd) {
        stationDict.set(String(st.station_cd), st);
      }
    });

    // =========================================================
    // 1. 投稿データを「座標＋駅名」でグループ化する
    // =========================================================
    const worksByLocation = new Map();
    const locationInfoDict = new Map(); // マーカー描画用に代表の駅情報を保持

    madsRes.forEach(mad => {
      const stInfo = stationDict.get(String(mad.station_cd));

      if (stInfo && stInfo.lat && stInfo.lon) {
        // ★ 座標と駅名を繋げて「完全に同じ場所・同じ名前」を表すキーを作る
        // 例: "43.0686_141.3508_札幌"
        const groupKey = `${stInfo.lat}_${stInfo.lon}_${stInfo.station_name}`;

        if (!worksByLocation.has(groupKey)) {
          worksByLocation.set(groupKey, []);
          locationInfoDict.set(groupKey, stInfo); // その場所の代表として駅情報を保存
        }
        worksByLocation.get(groupKey).push(mad);
      }
    });

    // =========================================================
    // 2. グループごとに1つのピンを刺し、リストを作成
    // =========================================================
    worksByLocation.forEach((works, groupKey) => {
      const stInfo = locationInfoDict.get(groupKey);

      // カスタムアイコンを指定してマーカーを設置
      const marker = L.marker([stInfo.lat, stInfo.lon]).addTo(map);
      
      // ポップアップのヘッダー部分
      let popupHtml = `
        <div style="font-weight: bold; font-size: 15px; margin-bottom: 8px; border-bottom: 2px solid var(--ios-blue); padding-bottom: 4px;">
        ${stInfo.station_name}駅 <span style="font-size: 12px; color: #666; font-weight: normal;">(${works.length}件)</span>
        </div>
        <div style="max-height: 200px; overflow-y: auto; padding-right: 5px;">
      `;

      // 作品リストを追加
      works.forEach((work, index) => {
        const separator = index > 0 ? `<hr style="border:0; border-top:1px dashed #ccc; margin: 10px 0;">` : '';
        const remarkHtml = work.remarks ? `<div style="font-size:12px; color:#666; margin-bottom:4px;">💬 ${work.remarks}</div>` : '';
        
        popupHtml += `
          ${separator}
          <div style="margin-bottom: 5px;">
            <div style="margin-bottom: 2px;"><a href="${work.url}" target="_blank" class="popup-title" style="font-weight: bold; color: var(--ios-blue); text-decoration: none;">${work.title}</a></div>
            ${remarkHtml}
            
          </div>
        `;
      });

      popupHtml += `</div>`;
      marker.bindPopup(popupHtml);
    });

  } catch (error) {
    console.error('データの読み込みに失敗しました:', error);
  }
}

// 実行
loadMapData();