import React, { useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const orangeFlightIcon = L.divIcon({
  className: 'custom-airplane-node',
  html: `
    <div style="position: relative; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center;">
      <div style="position: absolute; color: #ffffff; font-size: 28px; transform: rotate(-45deg); font-weight: bold; top: 1px; left: 1px; opacity: 0.9;">✈</div>
      <div style="position: absolute; color: #f97316; font-size: 28px; transform: rotate(-45deg); font-weight: bold;">✈</div>
    </div>
  `,
  iconSize: [36, 36],
  iconAnchor: [18, 18]
});

export default function App() {
  const [currentPage, setCurrentPage] = useState('home');
  
  // Auth State
  const [currentUser, setCurrentUser] = useState(() => {
    const saved = localStorage.getItem('skydelay_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'register'
  const [authName, setAuthName] = useState('');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState('');

  // Flights Tracker State
  const [inputAirline, setInputAirline] = useState('AA');
  const [inputFlightNumber, setInputFlightNumber] = useState('200');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('details'); 

  // Airports State
  const [inputAirport, setInputAirport] = useState('DFW');
  const [airportLoading, setAirportLoading] = useState(false);
  const [airportActiveTab, setAirportActiveTab] = useState('weather');
  const [airportData, setAirportData] = useState({
    name: 'Dallas Fort Worth International Airport',
    iataCode: 'DFW',
    icaoCode: 'KDFW',
    city: 'Dallas-Fort Worth',
    country: 'United States',
    weather: { temp: '31°C', condition: 'Mostly Clear', windSpeed: '14 mph', visibility: '10 miles', humidity: '54%' },
    traffic: { departureDelays: '15m average', arrivalDelays: '8m average', groundStopStatus: 'None', terminalCongestion: 'Moderate', activeRunways: '17R, 18L, 35C' }
  });

  const [flight, setFlight] = useState({
    airlineCode: '6E',
    flightNo: '204',
    airCarrierName: 'IndiGo Airlines',
    depCode: 'BOM',
    arrCode: 'DED',
    origin: { coords: [19.0896, 72.8656], city: 'Mumbai, IN', name: 'Chhatrapati Shivaji Maharaj Intl Airport', tz: 'IST', time: '08:40 AM', term: 'T2', gate: '86', craftType: 'Airbus A320neo', flightTime: '2h 20m' },
    destination: { coords: [30.1897, 78.1803], city: 'Dehradun, IN', name: 'Jolly Grant Airport', tz: 'IST', time: '11:00 AM', estimatedArrival: '11:00 AM', term: 'MAIN', gate: '-', baggage: 'B1', tailNumber: 'VT-IZI', estimatedFlightTime: '2h 20m' }
  });

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError('');
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/register';
    const payload = authMode === 'login' 
      ? { email: authEmail, password: authPassword }
      : { name: authName, email: authEmail, password: authPassword };

    try {
      const res = await fetch(`${backendUrl}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (!res.ok) {
        setAuthError(data.error || 'Authentication failed');
        return;
      }

      // Save session
      localStorage.setItem('skydelay_token', data.token);
      localStorage.setItem('skydelay_user', JSON.stringify(data.user));
      setCurrentUser(data.user);
      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
      setAuthName('');
    } catch (err) {
      setAuthError('Backend connection failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('skydelay_token');
    localStorage.removeItem('skydelay_user');
    setCurrentUser(null);
  };

  const handleSearchSubmit = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

    try {
      const res = await fetch(
        `${backendUrl}/api/flight/live?carrier=${inputAirline}&flightNumber=${inputFlightNumber}`
      );
      const data = await res.json();

      if (res.ok && data) {
        setFlight(data); // <--- THIS UPDATES THE METRICS ON SCREEN
      } else {
        alert(data.error || 'Flight not found');
      }
    } catch (err) {
      console.error('Fetch error:', err);
      alert('Failed to connect to flight search service.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSaveFlight = async () => {
    if (!currentUser) {
      alert('Please log in to save flights!');
      return;
    }

    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
    try {
      const res = await fetch(`${backendUrl}/api/user/saved-flights`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: currentUser.email,
          carrier: flight.airlineCode,
          number: flight.flightNo
        })
      });
      const data = await res.json();
      if (res.ok) {
        alert(`Saved flights updated for ${currentUser.name}!`);
      } else {
        alert(data.error || 'Could not save flight');
      }
    } catch (err) {
      console.error('Save failed:', err);
    }
  };

  const fetchAirportDetails = async (targetIata) => {
    setAirportLoading(true);
    const fallbackMeta = AIRPORT_DATA[targetIata] || { name: `${targetIata} Airport`, iata: targetIata, icao: targetIata, city: 'Unknown', country: 'Unknown' };
    const fallbackTraffic = AIRPORT_TRAFFIC[targetIata] || { departureDelays: '10m average', arrivalDelays: '5m average', groundStopStatus: 'None', terminalCongestion: 'Normal', activeRunways: 2 };
    let liveWeather = null;

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const weatherRes = await fetch(`${backendUrl}/api/airport/weather?iata=${targetIata}`);
      if (weatherRes.ok) liveWeather = await weatherRes.json();
    } catch (err) {
      console.error('Weather fetch error:', err);
    } finally {
      setAirportData({
        name: fallbackMeta.name,
        iataCode: targetIata,
        icaoCode: fallbackMeta.icao,
        city: fallbackMeta.city,
        country: fallbackMeta.country,
        weather: liveWeather || { temp: '25°C', condition: 'Clear Skies', windSpeed: '8 mph', visibility: '10 miles', humidity: '50%' },
        traffic: fallbackTraffic
      });
      setAirportLoading(false);
    }
  };

  const midPointCoords = [
    (flight.origin.coords[0] + flight.destination.coords[0]) / 2 + 2,
    (flight.origin.coords[1] + flight.destination.coords[1]) / 2
  ];
  const flightPathPlan = [flight.origin.coords, midPointCoords, flight.destination.coords];

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0b1326', color: '#fff', fontFamily: 'system-ui, sans-serif', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@700;900&display=swap" rel="stylesheet" />

      <style>{`
        .nav-link { background: none; border: none; color: #cbd5e1; padding: 24px 16px; font-size: 14px; font-weight: 600; cursor: pointer; transition: all 0.2s; border-bottom: 4px solid transparent; }
        .nav-link:hover { color: #38bdf8; }
        .nav-link.active { color: #38bdf8; border-bottom-color: #38bdf8; }
        .tab-btn { background: none; border: none; color: #94a3b8; padding: 12px 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; cursor: pointer; border-bottom: 3px solid transparent; transition: all 0.2s; }
        .tab-btn.active { color: #38bdf8; border-bottom-color: #38bdf8; background-color: rgba(56,189,248,0.05); }
        .feature-box { background: rgba(17, 26, 46, 0.9); border: 1px solid #1e2d4a; border-radius: 4px; padding: 25px; flex: 1; min-width: 300px; display: flex; flexDirection: column; justify-content: space-between; }
        .feature-item-btn { width: 100%; text-align: center; background: #38bdf8; border: none; padding: 12px 16px; color: #0b1326; font-weight: 700; font-size: 13px; text-transform: uppercase; margin-bottom: 10px; border-radius: 4px; cursor: pointer; transition: background 0.2s; }
        .feature-item-btn:hover { background: #0ea5e9; }
        .benefit-desc { font-size: 13px; color: #94a3b8; margin: 0 0 15px 0; line-height: 1.5; }
        .info-card-cell { background: #11192b; padding: 20px; borderRadius: 4px; border: 1px solid #1e2d4a; }
      `}</style>

      {/* Navigation Header */}
      <header style={{ backgroundColor: '#0c1833', borderBottom: '1px solid #1e2d4a', padding: '0 40px', height: '70px', display: 'flex', alignItems: 'center', zIndex: 1100 }}>
        <div onClick={() => setCurrentPage('home')} style={{ display: 'flex', alignItems: 'center', fontFamily: "'Orbitron', sans-serif", cursor: 'pointer', marginRight: '40px' }}>
          <span style={{ fontSize: '26px', fontWeight: '900', color: '#ffffff', transform: 'skewX(-6deg)' }}>S</span>
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff', letterSpacing: '1px' }}>KY</span>
          <span style={{ fontSize: '26px', fontWeight: '900', color: '#38bdf8', paddingLeft: '4px', borderLeft: '2px solid rgba(56, 189, 248, 0.6)', marginLeft: '5px', transform: 'skewX(-6deg)' }}>D</span>
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#38bdf8', letterSpacing: '1px' }}>ELAY</span>
        </div>
        
        <nav style={{ display: 'flex', gap: '10px', height: '100%' }}>
          <button className={`nav-link ${currentPage === 'home' ? 'active' : ''}`} onClick={() => setCurrentPage('home')}>Flights</button>
          <button className={`nav-link ${currentPage === 'airports' ? 'active' : ''}`} onClick={() => setCurrentPage('airports')}>Airports</button>
          <button className={`nav-link ${currentPage === 'tracker' ? 'active' : ''}`} onClick={() => setCurrentPage('tracker')}>On-Time Performance</button>
        </nav>

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '15px', alignItems: 'center' }}>
          {currentUser ? (
            <>
              <span style={{ fontSize: '14px', color: '#38bdf8', fontWeight: '700' }}>👤 {currentUser.name}</span>
              <button onClick={handleLogout} style={{ backgroundColor: '#ef4444', border: 'none', padding: '8px 16px', borderRadius: '4px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>LOGOUT</button>
            </>
          ) : (
            <>
              <button onClick={() => { setAuthMode('register'); setShowAuthModal(true); }} style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}>CREATE ACCOUNT</button>
              <button onClick={() => { setAuthMode('login'); setShowAuthModal(true); }} style={{ backgroundColor: '#1d4ed8', border: 'none', padding: '8px 16px', borderRadius: '4px', color: '#fff', fontSize: '13px', fontWeight: '700', cursor: 'pointer' }}>LOGIN</button>
            </>
          )}
        </div>
      </header>

      {/* AUTH MODAL */}
      {showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.75)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: '#111a2e', border: '1px solid #1e2d4a', borderRadius: '8px', padding: '30px', width: '100%', maxWidth: '400px', position: 'relative' }}>
            <button onClick={() => setShowAuthModal(false)} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', color: '#94a3b8', fontSize: '18px', cursor: 'pointer' }}>✕</button>

            <h2 style={{ fontSize: '20px', margin: '0 0 20px 0', color: '#38bdf8', textTransform: 'uppercase' }}>
              {authMode === 'login' ? 'Account Login' : 'Create Account'}
            </h2>

            {authError && <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', border: '1px solid #ef4444', color: '#ef4444', padding: '10px', borderRadius: '4px', marginBottom: '15px', fontSize: '13px' }}>{authError}</div>}

            <form onSubmit={handleAuthSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
              {authMode === 'register' && (
                <div>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>FULL NAME</label>
                  <input type="text" value={authName} onChange={(e) => setAuthName(e.target.value)} required style={{ width: '100%', padding: '10px', backgroundColor: '#0c1833', border: '1px solid #1e2d4a', borderRadius: '4px', color: '#fff' }} />
                </div>
              )}

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>EMAIL ADDRESS</label>
                <input type="email" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required style={{ width: '100%', padding: '10px', backgroundColor: '#0c1833', border: '1px solid #1e2d4a', borderRadius: '4px', color: '#fff' }} />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '5px' }}>PASSWORD</label>
                <input type="password" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required style={{ width: '100%', padding: '10px', backgroundColor: '#0c1833', border: '1px solid #1e2d4a', borderRadius: '4px', color: '#fff' }} />
              </div>

              <button type="submit" style={{ backgroundColor: '#38bdf8', border: 'none', padding: '12px', borderRadius: '4px', color: '#0b1326', fontWeight: '800', cursor: 'pointer', marginTop: '10px' }}>
                {authMode === 'login' ? 'SIGN IN' : 'REGISTER NOW'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '13px', color: '#94a3b8' }}>
              {authMode === 'login' ? (
                <>Don't have an account? <span onClick={() => { setAuthMode('register'); setAuthError(''); }} style={{ color: '#38bdf8', cursor: 'pointer', fontWeight: '700' }}>Register</span></>
              ) : (
                <>Already registered? <span onClick={() => { setAuthMode('login'); setAuthError(''); }} style={{ color: '#38bdf8', cursor: 'pointer', fontWeight: '700' }}>Login</span></>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Container Wrapper */}
      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, width: '100%', position: 'relative', backgroundImage: `linear-gradient(rgba(11, 19, 38, 0.25), rgba(11, 19, 38, 0.25)), url("/skydelayimage.jpg")`, backgroundSize: 'cover', backgroundPosition: 'center center', backgroundRepeat: 'no-repeat' }}>
        
        {/* HOMEPAGE */}
        {currentPage === 'home' && (
          <main style={{ flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '60px 20px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '60px' }}>
            <div style={{ textAlign: 'center', marginTop: '20px' }}>
              <h1 style={{ fontSize: '32px', fontWeight: '400', color: '#fff', margin: '0 0 10px 0' }}>SkyDelay Serves the Needs of On-the-go Travelers</h1>
              <div style={{ width: '100%', height: '2px', background: '#38bdf8', maxWidth: '850px', margin: '0 auto' }}></div>
            </div>

            <div style={{ backgroundColor: 'rgba(12, 24, 51, 0.9)', border: '1px solid #1e2d4a', borderRadius: '4px', padding: '35px', maxWidth: '850px', width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '500', margin: '0 0 5px 0' }}>Track a Flight</h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0' }}>Enter your flight information</p>

              <form onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                  <input type="text" placeholder="Carrier (e.g. AA)" value={inputAirline} onChange={(e) => setInputAirline(e.target.value)} style={{ flex: '1', minWidth: '120px', padding: '14px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#000', fontSize: '15px' }} />
                  <input type="text" placeholder="Flight Number (e.g. 200)" value={inputFlightNumber} onChange={(e) => setInputFlightNumber(e.target.value)} style={{ flex: '2', minWidth: '220px', padding: '14px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#000', fontSize: '15px' }} />
                </div>

                <div style={{ display: 'flex', gap: '15px' }}>
                  <button type="submit" style={{ backgroundColor: '#38bdf8', border: 'none', padding: '14px 35px', color: '#0b1326', fontWeight: '700', borderRadius: '4px', cursor: 'pointer', textTransform: 'uppercase', fontSize: '13px' }}>SEARCH</button>
                  <button type="button" onClick={() => setCurrentPage('tracker')} style={{ backgroundColor: '#475569', border: 'none', padding: '14px 25px', color: '#fff', fontWeight: '600', borderRadius: '4px', cursor: 'pointer', textTransform: 'uppercase', fontSize: '13px' }}>ADVANCED SEARCH</button>
                </div>
              </form>
            </div>

            <div style={{ marginTop: '20px' }}>
              <div style={{ backgroundColor: '#24324f', padding: '12px 20px', borderTopLeftRadius: '4px', borderTopRightRadius: '4px', fontSize: '14px', fontWeight: '600', color: '#cbd5e1', border: '1px solid #1e2d4a', borderBottom: 'none' }}>Features & Benefits of Using SkyDelay</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '25px', backgroundColor: 'rgba(12, 24, 51, 0.75)', border: '1px solid #1e2d4a', padding: '30px', borderBottomLeftRadius: '4px', borderBottomRightRadius: '4px' }}>
                <div className="feature-box">
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', color: '#38bdf8' }}>Flight Tracker Tools</h3>
                    <p className="benefit-desc">Monitor live airspace telemetry status, gate switches, scheduled runway metrics, and incoming baggage claims instantly.</p>
                  </div>
                  <button className="feature-item-btn" onClick={() => { setCurrentPage('tracker'); setActiveTab('details'); }}>LAUNCH FLIGHT TRACKER</button>
                </div>
                <div className="feature-box">
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', color: '#38bdf8' }}>Current Conditions</h3>
                    <p className="benefit-desc">Stay informed about local weather adjustments, ground stop orders, and airport terminal congestion parameters globally.</p>
                  </div>
                  <button className="feature-item-btn" onClick={() => setCurrentPage('airports')}>CHECK CURRENT CONDITIONS</button>
                </div>
                <div className="feature-box">
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '15px', color: '#38bdf8' }}>On-Time Performance</h3>
                    <p className="benefit-desc">Analyze historical delay logs over a 60-day interval to choose the most reliable routes and avoid unexpected transit layovers.</p>
                  </div>
                  <button className="feature-item-btn" onClick={() => { setCurrentPage('tracker'); setActiveTab('performance'); }}>VIEW ROUTE DELAYS</button>
                </div>
              </div>
            </div>
          </main>
        )}

        {/* AIRPORTS PAGE */}
        {currentPage === 'airports' && (
          <main style={{ flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '40px 20px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '25px' }}>
            <div style={{ backgroundColor: 'rgba(12, 24, 51, 0.9)', border: '1px solid #1e2d4a', borderRadius: '4px', padding: '30px' }}>
              <h2 style={{ fontSize: '20px', fontWeight: '500', margin: '0 0 5px 0' }}>Search Airport Conditions</h2>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px 0' }}>Enter an international airport IATA identifier to view live metrics</p>
              <form onSubmit={handleAirportSearch} style={{ display: 'flex', gap: '15px', alignItems: 'center', flexWrap: 'wrap' }}>
                <input type="text" placeholder="Airport IATA (e.g. DFW, ORD, LAX, BLR)" value={inputAirport} onChange={(e) => setInputAirport(e.target.value)} style={{ minWidth: '240px', padding: '12px', backgroundColor: '#fff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#000', fontSize: '15px' }} />
                <button type="submit" style={{ backgroundColor: '#38bdf8', border: 'none', padding: '12px 30px', color: '#0b1326', fontWeight: '700', borderRadius: '4px', cursor: 'pointer', textTransform: 'uppercase', fontSize: '13px' }}>FETCH LIVE CONDITIONS</button>
              </form>
            </div>

            {airportLoading && <div style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>Polling atmospheric telemetry loops and scheduling data...</div>}

            {!airportLoading && airportData && (
              <div style={{ backgroundColor: '#111a2e', border: '1px solid #1e2d4a', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: '#1a263f', padding: '24px', borderBottom: '1px solid #1e2d4a', display: 'flex', flexWrap: 'wrap', gap: '15px' }}>
                  <div>
                    <h2 style={{ margin: '0 0 4px 0', fontSize: '24px', fontWeight: '800' }}>{airportData.name} ({airportData.iataCode})</h2>
                    <span style={{ fontSize: '13px', color: '#94a3b8' }}>{airportData.city}, {airportData.country} — ICAO: {airportData.icaoCode}</span>
                  </div>
                  <div style={{ marginLeft: 'auto', backgroundColor: 'rgba(56, 189, 248, 0.1)', border: '1px solid #38bdf8', padding: '8px 16px', borderRadius: '4px', color: '#38bdf8', fontWeight: '700', fontSize: '14px', alignSelf: 'center' }}>🟢 Operational Status Stable</div>
                </div>

                <div style={{ backgroundColor: '#131e35', display: 'flex', borderBottom: '1px solid #1e2d4a', padding: '0 10px' }}>
                  <button className={`tab-btn ${airportActiveTab === 'weather' ? 'active' : ''}`} onClick={() => setAirportActiveTab('weather')}>Weather Conditions</button>
                  <button className={`tab-btn ${airportActiveTab === 'traffic' ? 'active' : ''}`} onClick={() => setAirportActiveTab('traffic')}>Traffic & Delays</button>
                </div>

                <div style={{ padding: '24px', backgroundColor: '#16223f' }}>
                  {airportActiveTab === 'weather' && (
                    <div>
                      <h3 style={{ margin: '0 0 20px 0', color: '#38bdf8', fontSize: '16px', textTransform: 'uppercase' }}>Meteorological Reports (METAR Stream)</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
                        <div className="info-card-cell"><span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>TEMPERATURE</span><span style={{ fontSize: '22px', fontWeight: '800', color: '#fff' }}>{airportData.weather.temp}</span></div>
                        <div className="info-card-cell"><span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>SKY CONDITION</span><span style={{ fontSize: '22px', fontWeight: '800', color: '#38bdf8' }}>{airportData.weather.condition}</span></div>
                        <div className="info-card-cell"><span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>WIND SPEED</span><span style={{ fontSize: '22px', fontWeight: '800', color: '#fff' }}>{airportData.weather.windSpeed}</span></div>
                        <div className="info-card-cell"><span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>VISIBILITY INDEX</span><span style={{ fontSize: '22px', fontWeight: '800', color: '#fff' }}>{airportData.weather.visibility}</span></div>
                      </div>
                    </div>
                  )}

                  {airportActiveTab === 'traffic' && (
                    <div>
                      <h3 style={{ margin: '0 0 20px 0', color: '#38bdf8', fontSize: '16px', textTransform: 'uppercase' }}>Terminal Congestion & Delay Matrix</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
                        <div className="info-card-cell"><span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>DEPARTURE FLOW RATE</span><span style={{ fontSize: '18px', fontWeight: '800' }}>{airportData.traffic.departureDelays}</span></div>
                        <div className="info-card-cell"><span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>ARRIVAL FLOW RATE</span><span style={{ fontSize: '18px', fontWeight: '800' }}>{airportData.traffic.arrivalDelays}</span></div>
                        <div className="info-card-cell"><span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>CONGESTION COEFFICIENT</span><span style={{ fontSize: '18px', fontWeight: '800', color: '#ef4444' }}>{airportData.traffic.terminalCongestion}</span></div>
                        <div className="info-card-cell"><span style={{ display: 'block', fontSize: '11px', color: '#64748b', fontWeight: '700' }}>GROUND STOP PROTOCOLS</span><span style={{ fontSize: '18px', fontWeight: '800', color: '#10b981' }}>{airportData.traffic.groundStopStatus}</span></div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </main>
        )}

        {/* TRACKER PAGE */}
        {currentPage === 'tracker' && (
          <main style={{ flex: 1, width: '100%', maxWidth: '1200px', margin: '0 auto', padding: '24px 15px', boxSizing: 'border-box', display: 'flex', flexDirection: 'column', gap: '25px', zIndex: 10 }}>
            <div style={{ backgroundColor: '#16223f', border: '1px solid #23355a', borderRadius: '4px', padding: '20px' }}>
              <form onSubmit={handleSearchSubmit}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>
                      AIRLINE PREFIX
                    </label>
                    <input 
                      type="text" 
                      value={inputAirline} 
                      onChange={(e) => setInputAirline(e.target.value)}
                      style={{ width: '100%', padding: '10px', backgroundColor: '#0c1833', border: '1px solid #2d4373', color: '#fff', boxSizing: 'border-box' }} 
                    />
                  </div>
                  
                  <div style={{ flex: 1 }}>
                    <label style={{ display: 'block', color: '#94a3b8', fontSize: '11px', fontWeight: '700', marginBottom: '6px' }}>
                      FLIGHT IDENTIFIER
                    </label>
                    <input 
                      type="text" 
                      value={inputFlightNumber} 
                      onChange={(e) => setInputFlightNumber(e.target.value)}
                      style={{ width: '100%', padding: '10px', backgroundColor: '#0c1833', border: '1px solid #2d4373', color: '#fff', boxSizing: 'border-box' }} 
                    />
                  </div>

                 <button
              type="submit"
              onClick={handleSearchSubmit}
              style={{ padding: '11px 32px', backgroundColor: '#38bdf8', border: 'none', borderRadius: '4px', color: '#0c1833', fontWeight: '800', cursor: 'pointer', height: '42px', alignSelf: 'flex-end' }}
            >
              QUERY LIVE METRICS
            </button>
          </div>
        </form>
      </div>

            {!loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '25px' }}>
                <div style={{ color: '#fff', fontSize: '22px', fontWeight: '700' }}>({flight.airlineCode}) {flight.airCarrierName} {flight.flightNo} Flight Tracker</div>
                <div style={{ backgroundColor: '#111a2e', border: '1px solid #1e2d4a', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ backgroundColor: '#24324f', padding: '12px 16px', color: '#94a3b8', fontSize: '13px', fontWeight: '600' }}>Core Dynamic Flight Operations Status</div>
                  <div style={{ padding: '24px', backgroundColor: '#1a263f' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '20px' }}>
                      <div style={{ minWidth: '180px' }}>
                        <div style={{ fontSize: '32px', fontWeight: '800', color: '#fff' }}>{flight.airlineCode} {flight.flightNo}</div>
                        <div style={{ fontSize: '13px', color: '#a1a1aa' }}>{flight.airCarrierName}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '25px', fontSize: '20px', fontWeight: '700' }}>
                        <div style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: '28px', color: '#fff' }}>{flight.depCode}</span><span style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', fontWeight: '400' }}>{flight.origin.city.split(',')[0]}</span></div>
                        <span style={{ color: '#38bdf8', fontSize: '28px' }}>✈</span>
                        <div style={{ textAlign: 'center' }}><span style={{ display: 'block', fontSize: '28px', color: '#fff' }}>{flight.arrCode}</span><span style={{ display: 'block', fontSize: '12px', color: '#a1a1aa', fontWeight: '400' }}>{flight.destination.city.split(',')[0]}</span></div>
                      </div>
                      <div style={{ marginLeft: 'auto', backgroundColor: '#10b981', color: '#fff', padding: '12px 24px', borderRadius: '4px' }}>
                        <div style={{ fontSize: '22px', fontWeight: '800' }}>Scheduled</div>
                        <div style={{ fontSize: '12px', fontWeight: '600', opacity: 0.9 }}>On time</div>
                      </div>
                    </div>
                    {/* Live Airport Weather Cards */}
          {(flight.originWeather || flight.destinationWeather) && (
            <div style={{ display: 'flex', gap: '15px', marginTop: '16px', flexWrap: 'wrap' }}>
              {flight.originWeather && (
                <div style={{ flex: 1, minWidth: '200px', backgroundColor: '#111a2e', padding: '12px 16px', borderRadius: '6px', border: '1px solid #1e2d4a', fontSize: '13px' }}>
                  <div style={{ color: '#38bdf8', fontWeight: '700', marginBottom: '4px' }}>🌤️ {flight.depCode} Weather</div>
                  <div style={{ color: '#fff', fontSize: '16px', fontWeight: '800' }}>{flight.originWeather.temp} — {flight.originWeather.condition}</div>
                  <div style={{ color: '#a1a1aa', fontSize: '11px', marginTop: '2px' }}>Wind: {flight.originWeather.windSpeed} | Vis: {flight.originWeather.visibility}</div>
                </div>
              )}
              {/* ML Delay Risk Assessment Card */}
          {flight && flight.riskPrediction && (
            <div style={{
              marginTop: '16px',
              backgroundColor: '#111a2e',
              border: '1px solid #38bdf8',
              borderLeft: '4px solid #38bdf8',
              borderRadius: '6px',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: '700', letterSpacing: '0.05em' }}>
                  ML Delay Risk Assessment
                </span>
                <h4 style={{ margin: '4px 0 0 0', fontSize: '18px', color: '#fff', fontWeight: '800' }}>
                  Delay Probability: <span style={{ color: '#38bdf8' }}>{flight.riskPrediction.delayProbability}</span>
                </h4>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#64748b', display: 'block', fontWeight: '700' }}>Model Confidence</span>
                <span style={{ fontSize: '14px', fontWeight: '800', color: '#10b981' }}>
                  {flight.riskPrediction.modelAccuracy} Accuracy
                </span>
              </div>
            </div>
          )}
              {flight.destinationWeather && (
                <div style={{ flex: 1, minWidth: '200px', backgroundColor: '#111a2e', padding: '12px 16px', borderRadius: '6px', border: '1px solid #1e2d4a', fontSize: '13px' }}>
                  <div style={{ color: '#38bdf8', fontWeight: '700', marginBottom: '4px' }}>🌤️ {flight.arrCode} Weather</div>
                  <div style={{ color: '#fff', fontSize: '16px', fontWeight: '800' }}>{flight.destinationWeather.temp} — {flight.destinationWeather.condition}</div>
                  <div style={{ color: '#a1a1aa', fontSize: '11px', marginTop: '2px' }}>Wind: {flight.destinationWeather.windSpeed} | Vis: {flight.destinationWeather.visibility}</div>
                </div>
              )}
            </div>
          )}
                  </div>

                  <div style={{ backgroundColor: '#131e35', display: 'flex', borderTop: '1px solid #1e2d4a', padding: '0 10px' }}>
                    <button className={`tab-btn ${activeTab === 'details' ? 'active' : ''}`} onClick={() => setActiveTab('details')}>View Flight Details</button>
                    <button className={`tab-btn ${activeTab === 'performance' ? 'active' : ''}`} onClick={() => setActiveTab('performance')}>On-Time Performance</button>
                    <button className={`tab-btn ${activeTab === 'timeline' ? 'active' : ''}`} onClick={() => setActiveTab('timeline')}>Event Timeline Log</button>
                  </div>
                </div>

                <div style={{ backgroundColor: '#16223f', border: '1px solid #23355a', borderRadius: '4px', padding: '24px' }}>
                  {activeTab === 'details' && (
                    <div>
                      <h3 style={{ margin: '0 0 20px 0', color: '#38bdf8', fontSize: '16px', textTransform: 'uppercase' }}>Full Operational Specifications Layout</h3>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                        <div style={{ background: '#11192b', padding: '20px', borderRadius: '4px', borderTop: '4px solid #10b981' }}>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: '#fff' }}>{flight.depCode} Departure</div>
                          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '15px' }}>{flight.origin.name}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: '1px solid #1e2d4a', paddingTop: '15px' }}>
                            <div><span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>SCHEDULED GATE DEPARTURE</span><span style={{ fontSize: '18px', fontWeight: '800' }}>{flight.origin.time}</span></div>
                            <div><span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>ESTIMATED GATE DEPARTURE</span><span style={{ fontSize: '18px', fontWeight: '800' }}>{flight.origin.time}</span></div>
                          </div>
                        </div>
                        <div style={{ background: '#11192b', padding: '20px', borderRadius: '4px', borderTop: '4px solid #10b981' }}>
                          <div style={{ fontSize: '24px', fontWeight: '800', color: '#fff' }}>{flight.arrCode} Arrival</div>
                          <div style={{ fontSize: '13px', color: '#94a3b8', marginBottom: '15px' }}>{flight.destination.name}</div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '15px', borderTop: '1px solid #1e2d4a', paddingTop: '15px' }}>
                            <div><span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>SCHEDULED GATE ARRIVAL</span><span style={{ fontSize: '18px', fontWeight: '800' }}>{flight.destination.time}</span></div>
                            <div><span style={{ display: 'block', fontSize: '11px', color: '#64748b' }}>ESTIMATED GATE ARRIVAL</span><span style={{ fontSize: '18px', fontWeight: '800', color: '#ef4444' }}>{flight.destination.estimatedArrival}</span></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'performance' && (
                    <div>
                      <h3 style={{ margin: '0 0 10px 0', color: '#38bdf8', fontSize: '16px' }}>HISTORICAL DELAY RATINGS INDEX</h3>
                      <div style={{ background: '#111a2e', padding: '24px', borderRadius: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '15px' }}>
                          <span>On-Time Arrival Ratio</span>
                          <span style={{ fontWeight: '700', color: '#10b981' }}>63% Stable</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === 'timeline' && (
                    <div>
                      <h3 style={{ margin: '0 0 15px 0', color: '#38bdf8', fontSize: '16px' }}>DYNAMIC TELEMETRY ADJUSTMENT LOGS</h3>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                        <thead>
                          <tr style={{ background: '#24324f', color: '#94a3b8' }}>
                            <th style={{ padding: '12px', textAlign: 'left' }}>DATE</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>UTC TIME</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>EVENT LEVEL</th>
                            <th style={{ padding: '12px', textAlign: 'left' }}>DATA REVISIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr style={{ borderBottom: '1px solid #1e2d4a' }}>
                            <td style={{ padding: '12px' }}>10 Jul</td>
                            <td style={{ padding: '12px', fontWeight: '700' }}>18:05</td>
                            <td style={{ padding: '12px', color: '#38bdf8' }}>Time Shift</td>
                            <td style={{ padding: '12px' }}>Estimated Arrival adjusted to {flight.destination.estimatedArrival}</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div style={{ backgroundColor: '#16223f', border: '1px solid #23355a', borderRadius: '4px', overflow: 'hidden' }}>
                  <div style={{ height: '440px', width: '100%' }}>
                    <MapContainer bounds={[flight.origin.coords, flight.destination.coords]} style={{ height: '100%', width: '100%' }}>
                      <TileLayer url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}" />
                      <Polyline positions={flightPathPlan} color="#38bdf8" weight={3} dashArray="6, 8" />
                      <Marker position={flight.origin.coords} />
                      <Marker position={flight.destination.coords} />
                      <Marker position={midPointCoords} icon={orangeFlightIcon} />
                    </MapContainer>
                  </div>
                </div>
              </div>
            )}
          </main>
        )}

        <footer style={{ padding: '30px', backgroundColor: '#0c1833', borderTop: '1px solid #23355a', color: '#64748b', fontSize: '13px', textAlign: 'center', marginTop: 'auto' }}>
          SkyDelay Operational Core Platform Interface Build &copy; 2026
        </footer>
      </div>
    </div>
  );
}