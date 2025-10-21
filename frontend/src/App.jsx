import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

// The URL to your FastAPI backend endpoint
const API_URL = import.meta.env.VITE_API_BASE_URL + '/fetchdata';
const HISTORY_LENGTH = 50; // Number of data points to show in charts and table

// --- SVG Icons (replaces react-icons/fa) ---
const FaThermometerHalf = () => (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M256 32C198.3 32 152 78.3 152 136V352c0 53-43 96-96 96s-96-43-96-96c0-20.6 6.2-39.8 17.2-56.2L224 0h64l146.8 299.8C445.8 312.2 452 331.4 452 352c0 53-43 96-96 96s-96-43-96-96V136c0-57.7 46.3-104 104-104zM344 352c0 22.1-17.9 40-40 40s-40-17.9-40-40V136c0-30.9-25.1-56-56-56s-56 25.1-56 56v216c0 22.1-17.9 40-40 40s-40-17.9-40-40c0-10.4 3.9-20 10.8-27.8L224 48.2V48h64v1.8l101.2 276.4c6.9 7.8 10.8 17.4 10.8 27.8z"></path></svg>
);
const FaTint = () => (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M256 512A256 256 0 0 1 0 256C0 167.6 114.9 32.7 256 0 397.1 32.7 512 167.6 512 256A256 256 0 0 1 256 512zm0-464C147.6 70.2 48 172.3 48 256c0 114.9 93.1 208 208 208s208-93.1 208-208c0-83.7-99.6-185.8-208-208z"></path></svg>
);
const FaExclamationTriangle = () => (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 576 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M569.517 440.013C587.975 472.007 564.806 512 527.94 512H48.054c-36.937 0-60.035-39.993-41.577-71.987L246.423 23.985c18.467-32.009 64.72-31.951 83.154 0l239.94 416.028zM288 354c-25.405 0-46 20.595-46 46s20.595 46 46 46 46-20.595 46-46-20.595-46-46-46zm-43.673-165.346l7.418 136c.347 6.364 5.609 11.346 11.982 11.346h48.546c6.373 0 11.635-4.982 11.982-11.346l7.418-136c.375-6.874-5.098-12.654-11.982-12.654h-63.383c-6.884 0-12.356 5.78-11.982 12.654z"></path></svg>
);
const FaShieldAlt = () => (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M466.5 83.7l-192-80a48.15 48.15 0 0 0-36.9 0l-192 80C27.7 93.7 0 122.4 0 158.5v209C0 422.3 33.2 460.9 76.5 476l192 64a48.15 48.15 0 0 0 36.9 0l192-64C478.8 460.9 512 422.3 512 367.5v-209c0-36.2-27.7-64.8-45.5-74.8zM256 448V256H64V160l192-80v176h192v104l-192 64z"></path></svg>
);
const FaChartLine = () => (
    <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="1em" width="1em" xmlns="http://www.w3.org/2000/svg"><path d="M500 384c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H12c-6.6 0-12-5.4-12-12V76c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v308h436zM341.5 242.8l-80-80c-4.7-4.7-12.3-4.7-17 0L144 263.5 109.2 229c-4.7-4.7-12.3-4.7-17 0l-40 40c-4.7 4.7-4.7 12.3 0 17l64 64c4.7 4.7 12.3 4.7 17 0l104.5-104c4.7-4.7 12.3-4.7 17 0l80 80c4.7 4.7 12.3 4.7 17 0l80-80c4.7-4.7 4.7-12.3 0-17l-40-40c-4.7-4.7-12.3-4.7-17 0z"></path></svg>
);

function App() {
    const [latestData, setLatestData] = useState(null);
    const [dataHistory, setDataHistory] = useState([]);
    const [status, setStatus] = useState('safe');
    const [error, setError] = useState(null);
    const [lastUpdated, setLastUpdated] = useState(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const response = await fetch(API_URL);
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status}`);
                }
                const allData = await response.json();

                if (!Array.isArray(allData) || allData.length === 0) {
                    throw new Error("No data available from the database yet.");
                }

                const latestRecord = allData[0];
                const historySlice = allData.slice(0, HISTORY_LENGTH).reverse();
                
                setLatestData(latestRecord);
                setDataHistory(historySlice);
                setLastUpdated(new Date());

                if (latestRecord.temp > 35) {
                    setStatus('danger');
                } else if (latestRecord.temp > 30) {
                    setStatus('warning');
                } else {
                    setStatus('safe');
                }

                setError(null);

            } catch (e) {
                console.error("Failed to fetch data:", e);
                setError(`Could not retrieve data. Please check the backend service. (${e.message})`);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 2000);

        return () => clearInterval(interval);
    }, []);

    const getStatusIcon = () => {
        switch (status) {
            case 'danger': return <FaExclamationTriangle size={40} />;
            case 'warning': return <FaExclamationTriangle size={40} />;
            default: return <FaShieldAlt size={40} />;
        }
    };
    
    const formatTimestamp = (isoString) => {
        if (!isoString) return '';
        return new Date(isoString).toLocaleTimeString();
    };

    return (
        <>
            <style>{`
                /* --- Global Styles & Variables --- */
                :root {
                  --bg-color: #10101a;
                  --card-bg: #1e1e2e;
                  --text-color: #e0e0e0;
                  --text-muted: #a0a0b0;
                  --border-color: #2a2a4a;
                  --safe-color: #4caf50;
                  --warning-color: #ffc107;
                  --danger-color: #f44336;
                  --font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
                }

                body {
                  margin: 0;
                  font-family: var(--font-family);
                  -webkit-font-smoothing: antialiased;
                  -moz-osx-font-smoothing: grayscale;
                  background-color: var(--bg-color);
                  color: var(--text-color);
                }

                /* --- Main App Layout --- */
                .App {
                  text-align: center;
                  padding: 1.5rem;
                }

                .App-header {
                  margin-bottom: 2rem;
                }

                .App-header h1 {
                  margin: 0;
                  font-size: 2.5rem;
                  font-weight: 700;
                  letter-spacing: -1px;
                }

                .last-updated {
                  color: var(--text-muted);
                  font-size: 0.9rem;
                  margin-top: 0.5rem;
                }

                /* --- Dashboard Grid --- */
                .dashboard-grid {
                  display: grid;
                  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                  gap: 1.5rem;
                  max-width: 1600px;
                  margin: 0 auto;
                }

                /* --- Card Base Styles --- */
                .card {
                  background-color: var(--card-bg);
                  border-radius: 16px;
                  padding: 1.5rem;
                  text-align: left;
                  border: 1px solid var(--border-color);
                  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
                }

                .card:hover {
                  transform: translateY(-5px);
                  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.2);
                }

                .card-icon {
                  font-size: 1.8rem;
                  margin-right: 1rem;
                  opacity: 0.7;
                }

                .card-content h2, .card-content h3 {
                  margin: 0;
                  font-size: 1.1rem;
                  font-weight: 500;
                  color: var(--text-muted);
                }

                .card-content p {
                  margin: 0.25rem 0 0 0;
                  font-size: 2rem;
                  font-weight: 700;
                }

                /* --- Specific Card Styles --- */

                .status-card, .data-card {
                  display: flex;
                  align-items: center;
                }

                .status-card .status-text {
                  font-size: 2.5rem;
                  font-weight: bold;
                }

                .chart-card {
                  grid-column: 1 / -1; 
                }

                .chart-title {
                  display: flex;
                  align-items: center;
                  gap: 0.75rem;
                  margin-bottom: 1.5rem;
                  font-size: 1.25rem;
                  font-weight: 600;
                  color: var(--text-color);
                }

                .table-card {
                  grid-column: 1 / -1;
                }

                .table-card h2 {
                    margin-top: 0;
                }

                .table-wrapper {
                    max-height: 400px;
                    overflow-y: auto;
                    border: 1px solid var(--border-color);
                    border-radius: 8px;
                }

                table {
                    width: 100%;
                    border-collapse: collapse;
                }

                th, td {
                    padding: 12px 15px;
                    text-align: left;
                    border-bottom: 1px solid var(--border-color);
                }

                thead th {
                    background-color: #2a2a4a;
                    position: sticky;
                    top: 0;
                    z-index: 1;
                }

                tbody tr:hover {
                    background-color: #252535;
                }

                /* --- Status Colors --- */
                .status-card.safe .status-text, .value.safe { color: var(--safe-color); }
                .status-card.warning .status-text, .value.warning { color: var(--warning-color); }
                .status-card.danger .status-text, .value.danger { color: var(--danger-color); }

                .status-card.safe .card-icon { color: var(--safe-color); }
                .status-card.warning .card-icon { color: var(--warning-color); }
                .status-card.danger .card-icon { color: var(--danger-color); }

                /* --- Error/Loading Cards --- */
                .error-card, .loading-card {
                  background-color: var(--card-bg);
                  border-radius: 16px;
                  padding: 2rem;
                  max-width: 600px;
                  margin: 2rem auto;
                  border: 1px solid var(--border-color);
                }
                .error-card {
                  background-color: #382828;
                  border-color: var(--danger-color);
                  color: #ffcdd2;
                }

                /* --- Responsive Design --- */
                @media (min-width: 1024px) {
                  .chart-card {
                    grid-column: span 1;
                  }
                  .status-card {
                    grid-column: 1 / -1;
                  }
                }

                @media (min-width: 1400px) {
                   .dashboard-grid {
                    grid-template-columns: repeat(3, 1fr);
                  }
                  .status-card, .data-card {
                    grid-column: span 1;
                  }
                }
            `}</style>
            <div className="App">
                <header className="App-header">
                    <h1>IoT Sensor Dashboard</h1>
                    {lastUpdated && <p className="last-updated">Last Updated: {lastUpdated.toLocaleTimeString()}</p>}
                </header>

                {error && <div className="error-card">{error}</div>}
                {!latestData && !error && <div className="loading-card">Connecting to Database...</div>}

                {latestData && (
                    <main className="dashboard-grid">
                        <div className={`status-card card ${status}`}>
                            <div className="card-icon">{getStatusIcon()}</div>
                            <div className="card-content">
                                <h2>System Status</h2>
                                <p className="status-text">{status.toUpperCase()}</p>
                            </div>
                        </div>

                        <div className="data-card card">
                            <div className="card-icon"><FaThermometerHalf /></div>
                            <div className="card-content">
                                <h3>Temperature</h3>
                                <p className={`value ${status}`}>{latestData.temp.toFixed(2)} °C</p>
                            </div>
                        </div>

                        <div className="data-card card">
                            <div className="card-icon"><FaTint /></div>
                            <div className="card-content">
                                <h3>Humidity</h3>
                                <p className="value">{latestData.humidity.toFixed(2)} %</p>
                            </div>
                        </div>
                        
                        <div className="chart-card card">
                            <h3 className="chart-title"><FaChartLine /> Worker 1 - Max Value</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={dataHistory} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                                    <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} stroke="#a0a0b0" fontSize={12} />
                                    <YAxis stroke="#a0a0b0" fontSize={12} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 30, 50, 0.9)', borderColor: '#2a2a4a' }} labelFormatter={formatTimestamp} />
                                    <Line type="monotone" dataKey="worker_1_max" name="Max Value" stroke="#8884d8" strokeWidth={2} dot={false} isAnimationActive={false} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                        
                        <div className="chart-card card">
                           <h3 className="chart-title"><FaChartLine /> Worker 2 - Max Value</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={dataHistory} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                                    <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} stroke="#a0a0b0" fontSize={12} />
                                    <YAxis stroke="#a0a0b0" fontSize={12} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 30, 50, 0.9)', borderColor: '#2a2a4a' }} labelFormatter={formatTimestamp} />
                                    <Line type="monotone" dataKey="worker_2_max" name="Max Value" stroke="#82ca9d" strokeWidth={2} dot={false} isAnimationActive={false}/>
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="chart-card card">
                            <h3 className="chart-title"><FaChartLine /> Worker 3 - Max Value</h3>
                            <ResponsiveContainer width="100%" height={250}>
                                <LineChart data={dataHistory} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                                    <XAxis dataKey="timestamp" tickFormatter={formatTimestamp} stroke="#a0a0b0" fontSize={12} />
                                    <YAxis stroke="#a0a0b0" fontSize={12} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(30, 30, 50, 0.9)', borderColor: '#2a2a4a' }} labelFormatter={formatTimestamp} />
                                    <Line type="monotone" dataKey="worker_3_max" name="Max Value" stroke="#ffc658" strokeWidth={2} dot={false} isAnimationActive={false}/>
                                </LineChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="table-card card">
                            <h2>Recent Data Records</h2>
                            <div className="table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Timestamp</th>
                                            <th>Temp (°C)</th>
                                            <th>Humidity (%)</th>
                                            <th>W1 Max</th>
                                            <th>W2 Max</th>
                                            <th>W3 Max</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {dataHistory.slice().reverse().map(record => (
                                            <tr key={record.id}>
                                                <td>{new Date(record.timestamp).toLocaleString()}</td>
                                                <td>{record.temp.toFixed(2)}</td>
                                                <td>{record.humidity.toFixed(2)}</td>
                                                <td>{record.worker_1_max}</td>
                                                <td>{record.worker_2_max}</td>
                                                <td>{record.worker_3_max}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </main>
                )}
            </div>
        </>
    );
}

export default App;

