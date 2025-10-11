import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { FaThermometerHalf, FaChartLine, FaExclamationTriangle, FaShieldAlt } from 'react-icons/fa';
import { FiActivity, FiBarChart2 } from 'react-icons/fi';
import './App.css';

const API_URL = 'https://gas-leak-detection-backend.onrender.com/fetchall';
const HISTORY_LENGTH = 30; // Number of data points to show in the chart

function App() {
  const [data, setData] = useState(null);
  const [history, setHistory] = useState([]);
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
        const newData = await response.json();
        
        // Ensure data is valid before setting state
        if (typeof newData.raw !== 'number') {
          throw new Error("Invalid data format received from server.");
        }
        
        setData(newData);
        setLastUpdated(new Date());

        // Update status based on raw value
        if (newData.raw > 3500) {
          setStatus('danger');
        } else if (newData.raw > 2500) {
          setStatus('warning');
        } else {
          setStatus('safe');
        }

        // Update history for the chart
        setHistory(prevHistory => {
          const newPoint = { time: new Date().toLocaleTimeString(), raw: newData.raw };
          const updatedHistory = [...prevHistory, newPoint];
          if (updatedHistory.length > HISTORY_LENGTH) {
            return updatedHistory.slice(1);
          }
          return updatedHistory;
        });

        setError(null); // Clear previous errors on successful fetch

      } catch (e) {
        console.error("Failed to fetch data:", e);
        setError("Could not connect to the sensor data feed. Please check the backend service.");
      }
    };

    fetchData(); // Fetch immediately on mount
    const interval = setInterval(fetchData, 2000); // Fetch every 2 seconds

    return () => clearInterval(interval); // Cleanup on unmount
  }, []);

  const getStatusIcon = () => {
    switch (status) {
      case 'danger':
        return <FaExclamationTriangle size={40} />;
      case 'warning':
        return <FaExclamationTriangle size={40} />;
      case 'safe':
        return <FaShieldAlt size={40} />;
      default:
        return null;
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>Gas Leakage Detector Dashboard</h1>
        {lastUpdated && <p className="last-updated">Last Updated: {lastUpdated.toLocaleTimeString()}</p>}
      </header>
      
      {error && <div className="error-card">{error}</div>}

      {!data && !error && <div className="loading-card">Connecting to Sensor...</div>}

      {data && (
        <main className="dashboard-grid">
          <div className={`status-card ${status}`}>
            <div className="status-icon">{getStatusIcon()}</div>
            <div className="status-text">
              <h2>System Status</h2>
              <p>{status.toUpperCase()}</p>
            </div>
          </div>

          <div className="data-item main-reading">
              <FaThermometerHalf className="data-icon" />
              <h3>Raw Gas Value</h3>
              <p className={`raw-value ${status}`}>{data.raw.toFixed(2)}</p>
              <span>(ADC Reading)</span>
          </div>

          <div className="data-item chart-container">
            <h3>Sensor Reading History (Last {HISTORY_LENGTH} points)</h3>
             <ResponsiveContainer width="100%" height={200}>
                <LineChart data={history} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
                    <XAxis dataKey="time" stroke="#a0a0b0" fontSize={12} />
                    <YAxis stroke="#a0a0b0" fontSize={12} />
                    <Tooltip
                        contentStyle={{
                            backgroundColor: 'rgba(30, 30, 50, 0.8)',
                            borderColor: '#2a2a4a'
                        }}
                    />
                    <Line type="monotone" dataKey="raw" stroke="var(--safe-color)" strokeWidth={2} dot={false} isAnimationActive={false}/>
                </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="data-item">
            <FiBarChart2 className="data-icon" />
            <h3>Moving Mean</h3>
            <p>{data.mean.toFixed(2)}</p>
          </div>

          <div className="data-item">
            <FiActivity className="data-icon" />
            <h3>Std. Deviation</h3>
            <p>{data.stddev.toFixed(2)}</p>
          </div>
          
          <div className="data-item">
            <FaChartLine className="data-icon" />
            <h3>Trend / Slope</h3>
            <p>{data.slope.toFixed(2)}</p>
          </div>

        </main>
      )}
    </div>
  );
}

export default App;