// GASのウェブアプリURLをここに設定
const GAS_URL = 'https://script.google.com/macros/s/AKfycbz01EQuEGIaqjoyydvJLa-kAC2AzP0bpWr_55G4P418DoWwq7T_QwNCecCuYxlbxAqVSQ/exec';

// 日本の領域を定義
const japanBounds = L.latLngBounds([20.0, 122.0], [46.0, 154.0]);

// マップの初期化
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

// ★追加：デフォルトピン画像が表示されないバグへの対策
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: '',
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

// =========================================================
// ★画面外のピンを描画しない（カリング）機能
// =========================================================
const allMarkers = []; // 全てのピンの情報を裏で保存しておく配列

// 画面内に存在するピンだけをマップに追加する関数
function updateVisibleMarkers() {
  const bounds = map.getBounds();
  // スクロール時のチラつきを防ぐため、画面の1.5倍の範囲を「描画エリア」とする
  const renderBounds = bounds.pad(0.5); 

  allMarkers.forEach(item => {
    if (renderBounds.contains(item.latLng)) {
      // 画面内（または周辺）に入ってきたらマップに追加
      if (!map.hasLayer(item.marker)) {
        map.addLayer(item.marker);
      }
    } else {
      // 画面から完全に外れたらマップから削除（メモリ解放）
      if (map.hasLayer(item.marker)) {
        map.removeLayer(item.marker);
      }
    }
  });
}

// マップを移動・ズームするたびにカリング処理を実行
map.on('moveend', updateVisibleMarkers);
map.on('zoomend', updateVisibleMarkers);


// データのロードとピン打ち
async function loadMapData() {
  try {
    const [madsRes, stationsCsv] = await Promise.all([
      fetch(GAS_URL).then(res => res.json()),
      fetchCsv('csv/station.csv')
    ]);

    const stationDict = new Map();
    stationsCsv.forEach(st => {
      if (st.station_cd) {
        stationDict.set(String(st.station_cd), st);
      }
    });

    const worksByLocation = new Map();
    const locationInfoDict = new Map();

    madsRes.forEach(mad => {
      const stInfo = stationDict.get(String(mad.station_cd));

      if (stInfo && stInfo.lat && stInfo.lon) {
        const groupKey = `${stInfo.lat}_${stInfo.lon}_${stInfo.station_name}`;

        if (!worksByLocation.has(groupKey)) {
          worksByLocation.set(groupKey, []);
          locationInfoDict.set(groupKey, stInfo);
        }
        worksByLocation.get(groupKey).push(mad);
      }
    });

    worksByLocation.forEach((works, groupKey) => {
      const stInfo = locationInfoDict.get(groupKey);

      // ★修正：デフォルトのピンを作成（まだマップには追加しない）
      const marker = L.marker([stInfo.lat, stInfo.lon]);
      
      let popupHtml = `
        <div style="font-weight: bold; font-size: 15px; margin-bottom: 8px; border-bottom: 2px solid var(--ios-blue); padding-bottom: 4px;">
          📍 ${stInfo.station_name}駅 <span style="font-size: 12px; color: #666; font-weight: normal;">(${works.length}件)</span>
        </div>
        <div style="max-height: 200px; overflow-y: auto; padding-right: 5px;">
      `;

      works.forEach((work, index) => {
        const separator = index > 0 ? `<hr style="border:0; border-top:1px dashed #ccc; margin: 10px 0;">` : '';
        const remarkHtml = work.remarks ? `<div style="font-size:12px; color:#666; margin-bottom:4px;">💬 ${work.remarks}</div>` : '';
        
        popupHtml += `
          ${separator}
          <div style="margin-bottom: 5px;">
            <div class="popup-title" style="margin-bottom: 2px;">${work.title}</div>
            <div class="popup-meta" style="margin-bottom: 4px;">[${work.category}]</div>
            ${remarkHtml}
            <a href="${work.url}" target="_blank" class="popup-link">動画を見る</a>
          </div>
        `;
      });

      popupHtml += `</div>`;
      marker.bindPopup(popupHtml);

      // ★修正：いきなり addTo(map) せず、配列に保存しておく
      allMarkers.push({
        marker: marker,
        latLng: L.latLng(stInfo.lat, stInfo.lon)
      });
    });

    // 全てのデータの準備が終わったら、初回分のマーカーだけを描画
    updateVisibleMarkers();

  } catch (error) {
    console.error('データの読み込みに失敗しました:', error);
  }
}

// 実行
loadMapData();