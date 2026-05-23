const cityCenters = [
  ['bathinda', 30.2110, 74.9455],
  ['bhatinda', 30.2110, 74.9455],
  ['delhi', 28.6139, 77.2090],
  ['new delhi', 28.6139, 77.2090],
  ['mumbai', 19.0760, 72.8777],
  ['bangalore', 12.9716, 77.5946],
  ['bengaluru', 12.9716, 77.5946],
  ['chandigarh', 30.7333, 76.7794],
  ['ludhiana', 30.9010, 75.8573],
  ['amritsar', 31.6340, 74.8723],
  ['patiala', 30.3398, 76.3869],
  ['mohali', 30.7046, 76.7179],
  ['jalandhar', 31.3260, 75.5762],
  ['mansa', 29.9995, 75.3937],
  ['faridkot', 30.6769, 74.7583],
  ['muktsar', 30.4762, 74.5155],
  ['jaipur', 26.9124, 75.7873],
  ['kolkata', 22.5726, 88.3639],
  ['hyderabad', 17.3850, 78.4867],
  ['pune', 18.5204, 73.8567]
];

function cityCenter(city = '') {
  const key = String(city || '').toLowerCase().trim();
  const found = cityCenters.find(([name]) => key.includes(name));
  return found ? { latitude: found[1], longitude: found[2] } : null;
}

function withLocationFallback(row = {}, index = 0) {
  if (row.latitude !== null && row.latitude !== undefined && row.longitude !== null && row.longitude !== undefined) {
    return { ...row };
  }
  const center = cityCenter(row.city) || { latitude: 28.6139, longitude: 77.2090 };
  return {
    ...row,
    latitude: Number((center.latitude + ((index % 5) - 2) * 0.006).toFixed(6)),
    longitude: Number((center.longitude + ((index % 7) - 3) * 0.006).toFixed(6)),
    location_source: cityCenter(row.city) ? 'city_fallback' : 'default_fallback'
  };
}

function distanceKm(a, b) {
  if (!a?.latitude || !a?.longitude || !b?.latitude || !b?.longitude) return null;
  const lat1 = Number(a.latitude);
  const lon1 = Number(a.longitude);
  const lat2 = Number(b.latitude);
  const lon2 = Number(b.longitude);
  if (![lat1, lon1, lat2, lon2].every(Number.isFinite)) return null;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLon = (lon2 - lon1) * rad;
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(s1 + s2), Math.sqrt(1 - s1 - s2))).toFixed(1));
}

module.exports = { cityCenter, distanceKm, withLocationFallback };
