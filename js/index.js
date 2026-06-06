// GASのウェブアプリURLをここに設定
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz01EQuEGIaqjoyydvJLa-kAC2AzP0bpWr_55G4P418DoWwq7T_QwNCecCuYxlbxAqVSQ/exec';

const map = L.map('map', { zoomControl: false }).setView([43.0686, 141.3508], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);
L.control.zoom({ position: 'bottomright' }).addTo(map);

// ★追加：Leafletのデフォルトピン画像が表示されないバグへの対策
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

    // 【デバッグ用】取得できたデータの中身をコンソールに表示
    console.log("GASからの投稿データ:", madsRes);
    console.log("CSVの駅データ (先頭3件):", stationsCsv.slice(0, 3));

    const stationDict = new Map();
    stationsCsv.forEach(st => {
      if (st.station_cd) {
        stationDict.set(String(st.station_cd), st);
      }
    });

    madsRes.forEach(mad => {
      // station_cd を文字列にして照合
      const stInfo = stationDict.get(String(mad.station_cd));
      
      // 【デバッグ用】結合の成否をコンソールに表示
      console.log(`照合確認: 投稿のstation_cd=${mad.station_cd} ->`, stInfo ? "成功" : "失敗 (駅データなし)");
      
// 結合して地図にプロットするループの中
      if (stInfo && stInfo.lat && stInfo.lon) {
        const marker = L.marker([stInfo.lat, stInfo.lon]).addTo(map);
        
        // 備考があれば表示用のHTMLを作成
        const remarkHtml = mad.remarks ? `<div style="font-size:12px; color:#666; margin-bottom:6px;">💬 ${mad.remarks}</div>` : '';
        
        const popupHtml = `
          <div class="popup-title">${mad.title}</div>
          <div class="popup-meta">📍 ${stInfo.station_name} [${mad.category}]</div>
          ${remarkHtml}
          <a href="${mad.url}" target="_blank" class="popup-link">動画を見る</a>
        `;
        marker.bindPopup(popupHtml);
      }
    });
  } catch (error) {
    console.error('データの読み込みに失敗しました:', error);
  }
}

// 実行
loadMapData();