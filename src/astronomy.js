const DEG = Math.PI / 180;
const norm = d => ((d % 360) + 360) % 360;
const signed = d => ((d + 180) % 360 + 360) % 360 - 180;
const rad = d => d * DEG;
const deg = r => r / DEG;

export function julianDay(date) { return date.getTime() / 86400000 + 2440587.5; }

export function sunCoordinates(date) {
  const jd = julianDay(date), T = (jd - 2451545) / 36525;
  const L0 = norm(280.46646 + T * (36000.76983 + T * .0003032));
  const M = norm(357.52911 + T * (35999.05029 - .0001537 * T));
  const e = .016708634 - T * (.000042037 + .0000001267 * T);
  const C = Math.sin(rad(M)) * (1.914602 - T * (.004817 + .000014 * T)) + Math.sin(rad(2 * M)) * (.019993 - .000101 * T) + Math.sin(rad(3 * M)) * .000289;
  const trueLong = L0 + C;
  const omega = 125.04 - 1934.136 * T;
  const lambda = trueLong - .00569 - .00478 * Math.sin(rad(omega));
  const eps0 = 23 + (26 + (21.448 - T * (46.815 + T * (.00059 - T * .001813))) / 60) / 60;
  const eps = eps0 + .00256 * Math.cos(rad(omega));
  const ra = norm(deg(Math.atan2(Math.cos(rad(eps)) * Math.sin(rad(lambda)), Math.cos(rad(lambda)))));
  const dec = deg(Math.asin(Math.sin(rad(eps)) * Math.sin(rad(lambda))));
  return { ra, dec, eclipticLongitude: norm(lambda), obliquity: eps };
}

export function moonCoordinates(date) {
  const d = julianDay(date) - 2451543.5;
  const N = rad(norm(125.1228 - .0529538083 * d));
  const i = rad(5.1454);
  const w = rad(norm(318.0634 + .1643573223 * d));
  const e = .0549;
  const M = rad(norm(115.3654 + 13.0649929509 * d));
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M));
  for (let k = 0; k < 4; k++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  const xv = Math.cos(E) - e, yv = Math.sqrt(1 - e * e) * Math.sin(E);
  const v = Math.atan2(yv, xv), r = Math.hypot(xv, yv);
  const vw = v + w;
  const x = r * (Math.cos(N) * Math.cos(vw) - Math.sin(N) * Math.sin(vw) * Math.cos(i));
  const y = r * (Math.sin(N) * Math.cos(vw) + Math.cos(N) * Math.sin(vw) * Math.cos(i));
  const z = r * Math.sin(vw) * Math.sin(i);
  const eps = rad(23.4393 - 3.563e-7 * d);
  const xe = x, ye = y * Math.cos(eps) - z * Math.sin(eps), ze = y * Math.sin(eps) + z * Math.cos(eps);
  return {
    ra: norm(deg(Math.atan2(ye, xe))),
    dec: deg(Math.atan2(ze, Math.hypot(xe, ye))),
    eclipticLongitude: norm(deg(Math.atan2(y, x))),
    eclipticLatitude: deg(Math.atan2(z, Math.hypot(x, y))),
    vectorEquatorial: { x: xe, y: ze, z: -ye },
    orbitalNormalScene: { x: Math.sin(i) * Math.sin(N), y: -Math.sin(i) * Math.cos(N) * Math.sin(eps) + Math.cos(i) * Math.cos(eps), z: Math.sin(i) * Math.cos(N) * Math.cos(eps) + Math.cos(i) * Math.sin(eps) },
    distanceEarthRadii: r * 60.2666
  };
}

export function localPosition(ra, dec, date, lat, lon) {
  const jd = julianDay(date), T = (jd - 2451545) / 36525;
  const gmst = norm(280.46061837 + 360.98564736629 * (jd - 2451545) + .000387933 * T * T - T * T * T / 38710000);
  const hourAngle = rad(signed(gmst + lon - ra));
  const phi = rad(lat), delta = rad(dec);
  const altitude = deg(Math.asin(Math.sin(phi) * Math.sin(delta) + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle)));
  const azimuth = norm(deg(Math.atan2(Math.sin(hourAngle), Math.cos(hourAngle) * Math.sin(phi) - Math.tan(delta) * Math.cos(phi))) + 180);
  return { altitude, azimuth };
}

function solarDeclinationAndEquation(date, localHours = 12) {
  const year = date.getUTCFullYear();
  const start = Date.UTC(year, 0, 0);
  const day = Math.floor((Date.UTC(year, date.getUTCMonth(), date.getUTCDate()) - start) / 86400000);
  const days = ((year % 4 === 0 && year % 100 !== 0) || year % 400 === 0) ? 366 : 365;
  const gamma = 2 * Math.PI / days * (day - 1 + (localHours - 12) / 24);
  const eq = 229.18 * (.000075 + .001868 * Math.cos(gamma) - .032077 * Math.sin(gamma) - .014615 * Math.cos(2 * gamma) - .040849 * Math.sin(2 * gamma));
  const dec = .006918 - .399912 * Math.cos(gamma) + .070257 * Math.sin(gamma) - .006758 * Math.cos(2 * gamma) + .000907 * Math.sin(2 * gamma) - .002697 * Math.cos(3 * gamma) + .00148 * Math.sin(3 * gamma);
  return { equationMinutes: eq, declination: deg(dec) };
}

export function daylight(date, lat, lon, zone, DateTime) {
  const localDate = DateTime.fromJSDate(date, { zone });
  const localNoon = localDate.set({ hour: 12, minute: 0, second: 0, millisecond: 0 });
  const calendarDay = new Date(Date.UTC(localDate.year, localDate.month - 1, localDate.day, 12));
  const { equationMinutes, declination } = solarDeclinationAndEquation(calendarDay);
  const phi = rad(lat), dec = rad(declination), altitude = rad(-.833);
  const cosH = (Math.sin(altitude) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
  if (cosH >= 1) return { minutes: 0, sunrise: null, sunset: null, state: '极夜' };
  if (cosH <= -1) return { minutes: 1440, sunrise: null, sunset: null, state: '极昼' };
  const hourAngle = deg(Math.acos(cosH));
  const minutes = hourAngle * 8;
  const noonClockMinutes = 720 - 4 * lon - equationMinutes + localNoon.offset;
  const start = localNoon.startOf('day');
  return { minutes, sunrise: start.plus({ minutes: noonClockMinutes - minutes / 2 }), sunset: start.plus({ minutes: noonClockMinutes + minutes / 2 }), state: '日出至日落' };
}

export function skyState(date, lat, lon) {
  const sun = sunCoordinates(date), moon = moonCoordinates(date);
  const sunSky = localPosition(sun.ra, sun.dec, date, lat, lon);
  const moonSky = localPosition(moon.ra, moon.dec, date, lat, lon);
  const elongation = norm(moon.eclipticLongitude - sun.eclipticLongitude);
  const illumination = (1 - Math.cos(rad(elongation))) / 2;
  const ageDays = elongation / 360 * 29.530588853;
  let phase;
  if (elongation < 22.5 || elongation >= 337.5) phase = '新月';
  else if (elongation < 67.5) phase = '娥眉月';
  else if (elongation < 112.5) phase = '上弦月';
  else if (elongation < 157.5) phase = '盈凸月';
  else if (elongation < 202.5) phase = '满月';
  else if (elongation < 247.5) phase = '亏凸月';
  else if (elongation < 292.5) phase = '下弦月';
  else phase = '残月';
  const twilight = sunSky.altitude > 0 ? '白昼' : sunSky.altitude > -6 ? '民用暮光' : sunSky.altitude > -12 ? '航海暮光' : sunSky.altitude > -18 ? '天文暮光' : '夜晚';
  return { sun: sunSky, moon: moonSky, phase, illumination, ageDays, waxing: elongation < 180, twilight };
}

export function sceneDirections(date) {
  const sun = sunCoordinates(date), moon = moonCoordinates(date);
  const toScene = (ra, dec) => {
    const a = rad(ra), d = rad(dec);
    return { x: Math.cos(d) * Math.cos(a), y: Math.sin(d), z: -Math.cos(d) * Math.sin(a) };
  };
  return { earthFromSun: { x: -toScene(sun.ra, sun.dec).x, y: -toScene(sun.ra, sun.dec).y, z: -toScene(sun.ra, sun.dec).z }, moonFromEarth: moon.vectorEquatorial, moonDistanceEarthRadii: moon.distanceEarthRadii, moonOrbitNormal: moon.orbitalNormalScene, siderealSpin: norm(280.46061837 + 360.98564736629 * (julianDay(date) - 2451545)) };
}
