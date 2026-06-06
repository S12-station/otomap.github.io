// GASのウェブアプリURLをここに設定
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz01EQuEGIaqjoyydvJLa-kAC2AzP0bpWr_55G4P418DoWwq7T_QwNCecCuYxlbxAqVSQ/exec';

// マップの初期化
const map = L.map('map', { zoomControl: false }).setView([43.0686, 141.3508], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// Leafletのデフォルトピン画像が表示されないバグへの対策
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

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
    // 1. 投稿データを「駅ごと」にグループ化する
    // =========================================================
    const worksByStation = new Map();
    
    madsRes.forEach(mad => {
      const stationCd = String(mad.station_cd);
      if (!worksByStation.has(stationCd)) {
        worksByStation.set(stationCd, []); // まだ配列がなければ作成
      }
      worksByStation.get(stationCd).push(mad); // 配列に作品を追加
    });

    // =========================================================
    // 2. 駅ごとに1つのピンを刺し、ポップアップの中にリストを作成
    // =========================================================
    worksByStation.forEach((works, stationCd) => {
      const stInfo = stationDict.get(stationCd);
      
      if (stInfo && stInfo.lat && stInfo.lon) {
        const marker = L.marker([stInfo.lat, stInfo.lon]).addTo(map);
        
        // ポップアップのヘッダー部分 (駅名と件数)
        let popupHtml = `
          <div style="font-weight: bold; font-size: 15px; margin-bottom: 8px; border-bottom: 2px solid var(--ios-blue); padding-bottom: 4px;">
            📍 ${stInfo.station_name}駅 <span style="font-size: 12px; color: #666; font-weight: normal;">(${works.length}件)</span>
          </div>
          <div style="max-height: 200px; overflow-y: auto; padding-right: 5px;">
        `;

        // その駅に紐づく作品をループして追加
        works.forEach((work, index) => {
          // 2件目以降は上部に細い線を入れて区切る
          const separator = index > 0 ? `<hr style="border:0; border-top:1px dashed #ccc; margin: 2px 0;">` : '';
          const remarkHtml = work.remarks ? `<div style="font-size:12px; color:#666; margin-bottom:4px;">💬 ${work.remarks}</div>` : '';
          
          popupHtml += `
            ${separator}
            <div style="margin-bottom: 5px;">
              <a href="${work.url}" target="_blank" style="text-decoration: none; color: inherit;"><div class="popup-title" style="margin-bottom: 2px;">${work.title}</div></a>
              ${remarkHtml}
            </div>
          `;
        });

        // HTMLを閉じる
        popupHtml += `</div>`;
        
        marker.bindPopup(popupHtml);
      }
    });

  } catch (error) {
    console.error('データの読み込みに失敗しました:', error);
  }
}

// 実行
loadMapData();